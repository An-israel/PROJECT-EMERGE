-- Project Emerge — editable footer contact details (phone, email, address).
-- Run AFTER 0002. Safe to run on an existing project (idempotent).

-- 1) Settings columns (all nullable — blank means "show a placeholder").
alter table public.settings
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists contact_address text;

-- 2) Rebuild the public-safe view to expose them (drop + create, because a new
--    column cannot be inserted mid-list with CREATE OR REPLACE VIEW).
drop view if exists public.public_settings;
create view public.public_settings
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
    contact_phone,
    contact_email,
    contact_address,
    one_time_grace_days,
    monthly_interval_months,
    behind_grace_days
  from public.settings
  where id = 1;

grant select on public.public_settings to anon, authenticated;
