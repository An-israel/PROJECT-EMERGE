-- Project Emerge — editable long-form landing copy (hero sentence + vision body).
-- Run AFTER 0003. Safe to run on an existing project (idempotent).

-- 1) Settings columns (nullable — blank falls back to the built-in default copy).
alter table public.settings
  add column if not exists hero_body text,
  add column if not exists vision_body text;

-- 2) Rebuild the public-safe view to expose them (drop + create).
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
    hero_body,
    vision_body,
    contact_phone,
    contact_email,
    contact_address,
    one_time_grace_days,
    monthly_interval_months,
    behind_grace_days
  from public.settings
  where id = 1;

grant select on public.public_settings to anon, authenticated;
