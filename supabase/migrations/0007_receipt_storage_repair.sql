-- Project Emerge — make sure the receipts bucket and its policies exist.
-- Run AFTER 0006. Safe to run on an existing project (idempotent).
--
-- WHY THIS EXISTS
-- Uploads were failing in production while every other feature worked. The
-- app's own storage reads/writes run with the service role and were fine; the
-- single operation that went through storage RLS as the partner — the upload —
-- was rejected. The usual cause is that the storage policy block in
-- 0001_init.sql never applied: many Supabase projects refuse
-- `create policy ... on storage.objects` from the SQL editor with
-- "must be owner of table objects", which aborts that statement while the rest
-- of the migration succeeds.
--
-- The app no longer depends on these policies (uploads now use a signed upload
-- URL minted with the service role), but the bucket must exist and the
-- policies are still the right configuration to have.

-- 1) The bucket itself. Without this, uploads fail with "Bucket not found".
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- 2) Re-assert the policies. If this project will not let you own
--    storage.objects from the SQL editor, the block below reports a notice
--    instead of failing the migration — set the same rules from
--    Storage > Policies in the dashboard.
do $$
begin
  drop policy if exists "receipts read own or admin" on storage.objects;
  create policy "receipts read own or admin" on storage.objects
    for select using (
      bucket_id = 'receipts' and (
        public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text
      )
    );

  drop policy if exists "receipts insert own" on storage.objects;
  create policy "receipts insert own" on storage.objects
    for insert with check (
      bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
    );

  drop policy if exists "receipts delete own or admin" on storage.objects;
  create policy "receipts delete own or admin" on storage.objects
    for delete using (
      bucket_id = 'receipts' and (
        public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text
      )
    );
exception
  when insufficient_privilege then
    raise notice
      'Could not create storage policies from SQL (insufficient privilege). Set them in Storage > Policies instead. Uploads still work: they use a service-role signed upload URL.';
end $$;

-- 3) Show what is actually in place, so the result of running this is visible.
select policyname
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'receipts%';
