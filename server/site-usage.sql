-- Run after gallery-schema.sql, before deploying usage protection.
-- Counters are shared by every Vercel instance. No raw IP addresses are stored.
begin;
create table if not exists public.site_usage_policies (
  policy text not null,
  scope text not null check (scope in ('global', 'client')),
  window_seconds integer not null check (window_seconds between 1 and 86400),
  max_requests integer not null check (max_requests > 0),
  primary key (policy, scope, window_seconds)
);
insert into public.site_usage_policies values
  ('gallery-read', 'client', 60, 60), ('gallery-read', 'global', 60, 1200),
  ('gallery-write', 'client', 60, 10), ('gallery-write', 'global', 60, 120),
  ('gallery-publish', 'client', 3600, 3), ('gallery-publish', 'client', 86400, 10), ('gallery-publish', 'global', 86400, 100),
  ('stats-read', 'client', 60, 60), ('stats-read', 'global', 60, 1200),
  ('stats-report', 'global', 60, 12), ('stats-report', 'global', 86400, 500)
on conflict do nothing;

create table if not exists public.site_usage_counters (
  policy text not null,
  scope text not null,
  subject text not null,
  window_seconds integer not null,
  window_start timestamptz not null,
  expires_at timestamptz not null,
  requests integer not null,
  primary key (policy, scope, subject, window_seconds)
);
create index if not exists site_usage_expiry on public.site_usage_counters (expires_at);
alter table public.site_usage_policies enable row level security;
alter table public.site_usage_counters enable row level security;
revoke all on public.site_usage_policies, public.site_usage_counters from public, anon, authenticated;

create or replace function public.check_site_usage(p_policy text, p_subject text)
returns jsonb language plpgsql security definer set search_path = '' set lock_timeout = '2s'
as $$
declare
  rule record;
  now_at timestamptz := clock_timestamp();
  starts_at timestamptz;
  ends_at timestamptz;
  subject_key text;
  used integer;
  retry_seconds integer := 0;
begin
  if p_policy is null or not exists (select 1 from public.site_usage_policies where policy = p_policy)
    or p_subject is null or length(p_subject) not between 1 and 64 then
    raise exception 'Invalid usage policy or subject';
  end if;
  -- Serialize only this policy, including its global and client buckets.
  -- Every check and increment happens in one transaction; no read/update race.
  perform pg_advisory_xact_lock(hashtextextended('spin2build-usage:' || p_policy, 0));
  now_at := clock_timestamp();
  delete from public.site_usage_counters where ctid in (
    select ctid from public.site_usage_counters where policy = p_policy and expires_at <= now_at limit 200
  );
  for rule in select * from public.site_usage_policies where policy = p_policy order by scope, window_seconds loop
    starts_at := to_timestamp(floor(extract(epoch from now_at) / rule.window_seconds) * rule.window_seconds);
    ends_at := starts_at + make_interval(secs => rule.window_seconds);
    subject_key := case when rule.scope = 'global' then 'global' else p_subject end;
    select requests into used from public.site_usage_counters
      where policy = p_policy and scope = rule.scope and subject = subject_key
        and window_seconds = rule.window_seconds and window_start = starts_at;
    if coalesce(used, 0) >= rule.max_requests then
      retry_seconds := greatest(retry_seconds, ceil(extract(epoch from ends_at - now_at))::integer);
    end if;
  end loop;
  if retry_seconds > 0 then return jsonb_build_object('allowed', false, 'retry_after', retry_seconds); end if;
  for rule in select * from public.site_usage_policies where policy = p_policy order by scope, window_seconds loop
    starts_at := to_timestamp(floor(extract(epoch from now_at) / rule.window_seconds) * rule.window_seconds);
    ends_at := starts_at + make_interval(secs => rule.window_seconds);
    subject_key := case when rule.scope = 'global' then 'global' else p_subject end;
    insert into public.site_usage_counters as counter values (p_policy, rule.scope, subject_key, rule.window_seconds, starts_at, ends_at, 1)
    on conflict (policy, scope, subject, window_seconds) do update
      set requests = case when counter.window_start = excluded.window_start then counter.requests + 1 else 1 end,
          window_start = excluded.window_start, expires_at = excluded.expires_at;
  end loop;
  return jsonb_build_object('allowed', true, 'retry_after', 0);
end;
$$;
revoke all on function public.check_site_usage(text, text) from public, anon, authenticated;
grant execute on function public.check_site_usage(text, text) to service_role;

-- One bounded database query per gallery page; legacy image data is excluded.
create or replace function public.gallery_page(p_page integer default 0, p_search text default '', p_filter text default 'All')
returns table(project jsonb, status text, created_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare pattern text;
begin
  if p_page is null or p_page not between 0 and 1000 or p_search is null or length(p_search) > 80
    or p_filter is null or p_filter not in ('All', 'From Spin2Build', 'Original Ideas', 'Featured', 'Newest') then
    raise exception 'Invalid gallery query';
  end if;
  pattern := '%' || replace(replace(replace(p_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return query select g.project - 'screenshotUrl', g.status, g.created_at from public.gallery_projects g
    where g.status = 'approved'
      and (p_filter <> 'From Spin2Build' or g.project->>'source' = 'spin2build')
      and (p_filter <> 'Original Ideas' or g.project->>'source' = 'original')
      and (p_filter <> 'Featured' or g.project->>'featured' = 'true')
      and (p_search = '' or concat_ws(' ', g.project->>'projectName', g.project->>'description',
        g.project->>'projectType', g.project->>'topic', g.project->>'builderName', g.project->>'location', g.project->>'techStack') ilike pattern)
    order by g.created_at desc, g.id desc limit 25 offset p_page * 24;
end;
$$;
revoke all on function public.gallery_page(integer, text, text) from public, anon, authenticated;
grant execute on function public.gallery_page(integer, text, text) to service_role;
commit;
