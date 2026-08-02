-- Project Emerge — SQL seed (run AFTER 0001_init.sql).
-- This is the no-CLI path: paste into the Supabase SQL Editor and run.
-- It seeds the single settings row. Admin creation is a two-step (see bottom),
-- because Supabase auth users must be created through Auth, not raw SQL.

-- 1) Settings row (campaign constants + bank details).
insert into public.settings (
  id, campaign_title, campaign_subtitle, scripture, goal, currency_symbol,
  bank_account_name, bank_account_number, bank_name,
  one_time_grace_days, monthly_interval_months, behind_grace_days
) values (
  1,
  'Project Emerge',
  'Building Together. Rising Visibly.',
  'Haggai 1:8',
  100000000,
  '₦',
  'IdealLife Global City Outreach - Project',
  '4005900458',
  'Moniepoint',
  30, 1, 3
)
on conflict (id) do update set
  campaign_title = excluded.campaign_title,
  campaign_subtitle = excluded.campaign_subtitle,
  scripture = excluded.scripture,
  goal = excluded.goal,
  bank_account_name = excluded.bank_account_name,
  bank_account_number = excluded.bank_account_number,
  bank_name = excluded.bank_name,
  one_time_grace_days = excluded.one_time_grace_days,
  monthly_interval_months = excluded.monthly_interval_months,
  behind_grace_days = excluded.behind_grace_days;

-- 2) Create the ADMIN user.
--    a) In the Supabase dashboard: Authentication -> Users -> "Add user".
--       Enter the admin email + a password, and tick "Auto Confirm User".
--    b) Copy that new user's UUID (User ID), then run the statement below with
--       the UUID and the SAME email pasted in. This makes them an admin.
--
-- insert into public.profiles (id, full_name, email, phone, role, show_on_honor_roll)
-- values (
--   '00000000-0000-0000-0000-000000000000',  -- <-- paste the auth user UUID
--   'Ideal Life City Admin',
--   'admin@ideallifecity.org',               -- <-- paste the SAME email
--   '0000000000',
--   'admin',
--   false
-- )
-- on conflict (id) do update set role = 'admin';
