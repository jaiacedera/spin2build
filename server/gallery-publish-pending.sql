-- Run once in Supabase SQL Editor to publish builds submitted before
-- immediate publishing was enabled. Rejected builds stay hidden.
begin;
alter table public.gallery_projects alter column status set default 'approved';
update public.gallery_projects
set status = 'approved',
    project = jsonb_set(project, '{status}', '"approved"'::jsonb)
where status = 'pending';
commit;
