-- Run once in the Supabase SQL editor. No visitor accounts or public table access.
create table if not exists public.gallery_projects (
  id uuid primary key,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  project jsonb not null
);
create index if not exists gallery_projects_status_date on public.gallery_projects (status, created_at desc);
alter table public.gallery_projects enable row level security;
revoke all on public.gallery_projects from anon, authenticated;
grant select, insert, update on public.gallery_projects to service_role;

-- Moderation happens privately in the database; there is no public mutation route.
-- update public.gallery_projects set status = 'approved' where id = '<submission UUID>';
-- update public.gallery_projects set status = 'rejected' where id = '<submission UUID>';
-- update public.gallery_projects set project = jsonb_set(project, '{featured}', 'true') where id = '<submission UUID>';
