-- Project Emerge — initial schema, RLS, storage, and RPCs.
-- Run against a fresh Supabase project.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text not null,
  role text not null default 'partner' check (role in ('partner', 'admin')),
  show_on_honor_roll boolean not null default false,
  honor_roll_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.partnerships (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null unique references public.profiles(id) on delete cascade,
  tier text not null check (tier in ('100000','200000','300000','500000','1000000','2000000_plus')),
  amount numeric(14,2) not null check (amount > 0),
  plan text not null check (plan in ('one_time','three_months','six_months','ten_months')),
  start_date date not null default current_date,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  created_at timestamptz not null default now(),
  -- The open-ended tier must be at least 2,000,000.
  constraint custom_tier_minimum check (tier <> '2000000_plus' or amount >= 2000000)
);

create table if not exists public.installments (
  id uuid primary key default gen_random_uuid(),
  partnership_id uuid not null references public.partnerships(id) on delete cascade,
  sequence int not null,
  due_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (partnership_id, sequence)
);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.profiles(id) on delete cascade,
  partnership_id uuid not null references public.partnerships(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  transfer_date date not null,
  reference text,
  file_path text not null,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reject_reason text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  -- A rejected receipt must carry a reason.
  constraint reject_reason_required check (status <> 'rejected' or reject_reason is not null)
);

create index if not exists receipts_partner_idx on public.receipts(partner_id);
create index if not exists receipts_partnership_idx on public.receipts(partnership_id);
create index if not exists receipts_status_idx on public.receipts(status);
create index if not exists installments_partnership_idx on public.installments(partnership_id);

create table if not exists public.contact_logs (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.profiles(id) on delete cascade,
  admin_id uuid not null references public.profiles(id),
  method text not null check (method in ('phone','email','whatsapp','other')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists contact_logs_partner_idx on public.contact_logs(partner_id);

create table if not exists public.settings (
  id int primary key default 1,
  campaign_title text not null,
  campaign_subtitle text not null,
  scripture text not null,
  goal numeric(14,2) not null,
  currency_symbol text not null default '₦',
  bank_account_name text not null,
  bank_account_number text not null,
  bank_name text not null,
  one_time_grace_days int not null default 30,
  monthly_interval_months int not null default 1,
  behind_grace_days int not null default 3,
  updated_at timestamptz not null default now(),
  constraint settings_singleton check (id = 1)
);

-- ---------------------------------------------------------------------------
-- Helper: is_admin()
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Public-safe settings view (bank + campaign copy, NO goal)
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
    one_time_grace_days,
    monthly_interval_months,
    behind_grace_days
  from public.settings
  where id = 1;

grant select on public.public_settings to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public honor roll view (names ONLY, opted-in profiles). No email/phone/amount.
-- ---------------------------------------------------------------------------
create or replace view public.honor_roll
with (security_invoker = false) as
  select coalesce(nullif(trim(honor_roll_name), ''), full_name) as display_name
  from public.profiles
  where show_on_honor_roll = true
  order by display_name asc;

grant select on public.honor_roll to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.partnerships enable row level security;
alter table public.installments enable row level security;
alter table public.receipts enable row level security;
alter table public.contact_logs enable row level security;
alter table public.settings enable row level security;

-- profiles: own row or admin
create policy profiles_select_self on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy profiles_insert_admin on public.profiles
  for insert with check (public.is_admin());
create policy profiles_delete_admin on public.profiles
  for delete using (public.is_admin());

-- partnerships
create policy partnerships_select on public.partnerships
  for select using (partner_id = auth.uid() or public.is_admin());
create policy partnerships_insert_self on public.partnerships
  for insert with check (partner_id = auth.uid() or public.is_admin());
create policy partnerships_admin_update on public.partnerships
  for update using (public.is_admin()) with check (public.is_admin());
create policy partnerships_admin_delete on public.partnerships
  for delete using (public.is_admin());

-- installments (owned via parent partnership)
create policy installments_select on public.installments
  for select using (
    public.is_admin() or exists (
      select 1 from public.partnerships p
      where p.id = installments.partnership_id and p.partner_id = auth.uid()
    )
  );
create policy installments_insert on public.installments
  for insert with check (
    public.is_admin() or exists (
      select 1 from public.partnerships p
      where p.id = installments.partnership_id and p.partner_id = auth.uid()
    )
  );
create policy installments_admin_update on public.installments
  for update using (public.is_admin()) with check (public.is_admin());
create policy installments_admin_delete on public.installments
  for delete using (public.is_admin());

-- receipts
create policy receipts_select on public.receipts
  for select using (partner_id = auth.uid() or public.is_admin());
create policy receipts_insert_self on public.receipts
  for insert with check (partner_id = auth.uid());
-- Partner may update/delete only their own PENDING receipts; admin anything.
create policy receipts_update_pending on public.receipts
  for update using (
    public.is_admin() or (partner_id = auth.uid() and status = 'pending')
  ) with check (
    public.is_admin() or (partner_id = auth.uid() and status = 'pending')
  );
create policy receipts_delete_pending on public.receipts
  for delete using (
    public.is_admin() or (partner_id = auth.uid() and status = 'pending')
  );

-- contact_logs: admins only
create policy contact_logs_admin_all on public.contact_logs
  for all using (public.is_admin()) with check (public.is_admin());

-- settings: read to authenticated; write to admins only.
-- (The `goal` column is only ever selected in admin server code; partners read
--  campaign/bank fields through the public_settings view.)
create policy settings_select_auth on public.settings
  for select using (public.is_admin());
create policy settings_update_admin on public.settings
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage bucket for receipts (private)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Partner may read/write only files under their own {partner_id}/ prefix.
create policy "receipts read own or admin" on storage.objects
  for select using (
    bucket_id = 'receipts' and (
      public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text
    )
  );
create policy "receipts insert own" on storage.objects
  for insert with check (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "receipts delete own or admin" on storage.objects
  for delete using (
    bucket_id = 'receipts' and (
      public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- ---------------------------------------------------------------------------
-- Atomic partner sign-up RPC
--   Creates profile + partnership + installments in ONE function body.
--   Any failure raises and rolls the whole thing back. Called by the server
--   action with the service role AFTER the auth user is created.
-- ---------------------------------------------------------------------------
create or replace function public.create_partner_signup(
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_show_on_honor_roll boolean,
  p_honor_roll_name text,
  p_tier text,
  p_amount numeric,
  p_plan text,
  p_start_date date,
  p_installments jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partnership_id uuid;
  v_item jsonb;
begin
  insert into public.profiles (id, full_name, email, phone, role, show_on_honor_roll, honor_roll_name)
  values (p_user_id, p_full_name, p_email, p_phone, 'partner', p_show_on_honor_roll, nullif(p_honor_roll_name, ''));

  insert into public.partnerships (partner_id, tier, amount, plan, start_date)
  values (p_user_id, p_tier, p_amount, p_plan, p_start_date)
  returning id into v_partnership_id;

  for v_item in select * from jsonb_array_elements(p_installments)
  loop
    insert into public.installments (partnership_id, sequence, due_date, amount)
    values (
      v_partnership_id,
      (v_item->>'sequence')::int,
      (v_item->>'due_date')::date,
      (v_item->>'amount')::numeric
    );
  end loop;

  return v_partnership_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Approve / reject receipt RPCs (admin only; enforced by is_admin()).
-- ---------------------------------------------------------------------------
create or replace function public.approve_receipt(p_receipt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  update public.receipts
    set status = 'approved', reject_reason = null,
        reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_receipt_id;
end;
$$;

create or replace function public.reject_receipt(p_receipt_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a reason is required to reject a receipt';
  end if;
  update public.receipts
    set status = 'rejected', reject_reason = p_reason,
        reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_receipt_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Guard: never demote the last admin.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_last_admin()
returns trigger
language plpgsql
as $$
begin
  if old.role = 'admin' and new.role <> 'admin' then
    if (select count(*) from public.profiles where role = 'admin') <= 1 then
      raise exception 'cannot demote the last remaining admin';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_last_admin on public.profiles;
create trigger trg_enforce_last_admin
  before update of role on public.profiles
  for each row execute function public.enforce_last_admin();
