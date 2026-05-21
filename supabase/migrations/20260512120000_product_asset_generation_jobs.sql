-- Align generated-asset jobs with code-owned ownerId payloads while preserving
-- old owner_id payloads that may still exist in queued rows.

alter table public.jobs
  add column if not exists result jsonb;

drop policy if exists "Jobs are viewable by owner payload" on public.jobs;
create policy "Jobs are viewable by owner payload"
on public.jobs for select
using (
  auth.uid() is not null
  and (
    (payload ? 'ownerId' and payload->>'ownerId' = auth.uid()::text)
    or (payload ? 'owner_id' and payload->>'owner_id' = auth.uid()::text)
  )
);
