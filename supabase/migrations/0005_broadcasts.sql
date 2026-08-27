-- Project Emerge — admin broadcast email (announcements to registered users).
-- Run AFTER 0004. Safe to run on an existing project (idempotent).

-- 1) Partners choose whether to receive campaign announcements. Transactional
--    mail (receipt approved/rejected, reminders) always sends and ignores this.
alter table public.profiles
  add column if not exists email_opt_out boolean not null default false;

-- 2) A record of every broadcast an admin sends.
create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  sent_by uuid references public.profiles(id) on delete set null,
  audience text not null check (
    audience in ('all','partners','admins','behind','on_track','completed')
  ),
  subject text not null,
  body text not null,
  recipient_count int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  status text not null check (status in ('sent','partial','failed','skipped')),
  created_at timestamptz not null default now()
);

create index if not exists broadcasts_created_idx
  on public.broadcasts(created_at desc);

alter table public.broadcasts enable row level security;

-- Admins only, in every direction. Sending itself runs with the service role.
drop policy if exists broadcasts_admin_all on public.broadcasts;
create policy broadcasts_admin_all on public.broadcasts
  for all using (public.is_admin()) with check (public.is_admin());
