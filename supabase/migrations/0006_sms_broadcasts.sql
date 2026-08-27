-- Project Emerge — bulk SMS alongside broadcast email.
-- Run AFTER 0005. Safe to run on an existing project (idempotent).

-- 1) Partners opt out of SMS announcements separately from email ones.
--    Transactional messages about their own receipts ignore both flags.
alter table public.profiles
  add column if not exists sms_opt_out boolean not null default false;

-- 2) The broadcast log now covers both channels. Existing rows are email.
alter table public.broadcasts
  add column if not exists channel text not null default 'email';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'broadcasts_channel_check'
  ) then
    alter table public.broadcasts
      add constraint broadcasts_channel_check
      check (channel in ('email', 'sms'));
  end if;
end $$;

-- An SMS has no subject line.
alter table public.broadcasts alter column subject drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'broadcasts_email_needs_subject'
  ) then
    alter table public.broadcasts
      add constraint broadcasts_email_needs_subject
      check (channel <> 'email' or subject is not null);
  end if;
end $$;

create index if not exists broadcasts_channel_idx
  on public.broadcasts(channel, created_at desc);
