-- Project Emerge — add an admin-managed hero background image for the landing page.
-- Run AFTER 0001_init.sql. Safe to run on an existing project (idempotent).

-- ---------------------------------------------------------------------------
-- 1) Settings: store the public URL of the chosen hero background (nullable).
-- ---------------------------------------------------------------------------
alter table public.settings
  add column if not exists hero_image_url text;

-- ---------------------------------------------------------------------------
-- 2) Expose it on the public-safe settings view (still NO goal/totals).
--    The view is recreated to add the column.
-- ---------------------------------------------------------------------------
create or replace view public.public_settings
with (security_invoker = false) as
  select
    campaign_title,
    campaign_subtitle,
    scripture,
    currency_symbol,
    bank_account_name,
    bank_account_number,
    bank_name,
    hero_image_url,
    one_time_grace_days,
    monthly_interval_months,
    behind_grace_days
  from public.settings
  where id = 1;

grant select on public.public_settings to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Public bucket for branding assets (the landing page background is public).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do update set public = true;

-- Public read is automatic for a public bucket. Writes are admin-only.
-- (Uploads run through the service role, which bypasses RLS; these policies
--  make admin-only intent explicit and cover any non-service-role path.)
drop policy if exists "branding read all" on storage.objects;
create policy "branding read all" on storage.objects
  for select using (bucket_id = 'branding');

drop policy if exists "branding admin insert" on storage.objects;
create policy "branding admin insert" on storage.objects
  for insert with check (bucket_id = 'branding' and public.is_admin());

drop policy if exists "branding admin update" on storage.objects;
create policy "branding admin update" on storage.objects
  for update using (bucket_id = 'branding' and public.is_admin())
  with check (bucket_id = 'branding' and public.is_admin());

drop policy if exists "branding admin delete" on storage.objects;
create policy "branding admin delete" on storage.objects
  for delete using (bucket_id = 'branding' and public.is_admin());
