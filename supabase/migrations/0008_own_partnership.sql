-- Project Emerge — let an existing account create its own partnership.
-- Run AFTER 0007. Safe to run on an existing project (idempotent).
--
-- WHY THIS EXISTS
-- The only way to get a partnership was the public sign-up flow, which
-- creates a brand new auth user. An admin seeded with `pnpm seed`, or anyone
-- promoted to admin before pledging, therefore had a profile but no
-- partnership — and no way to make one without a second account. They could
-- not upload receipts, and their giving never counted.
--
-- Mirrors create_partner_signup, but for a profile that already exists.
-- Keyed on auth.uid(), so it can only ever create a partnership for the
-- caller: the client cannot name someone else.

create or replace function public.create_partnership_for_me(
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
  v_user uuid := auth.uid();
  v_partnership_id uuid;
  v_item jsonb;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if not exists (select 1 from public.profiles where id = v_user) then
    raise exception 'no profile for this account';
  end if;

  -- partnerships.partner_id is unique, so a second call raises 23505 and the
  -- caller reports "you already have a partnership".
  insert into public.partnerships (partner_id, tier, amount, plan, start_date)
  values (v_user, p_tier, p_amount, p_plan, p_start_date)
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

-- Signed-in accounts only. Anonymous visitors use the sign-up flow instead.
revoke all on function public.create_partnership_for_me(text, numeric, text, date, jsonb) from public, anon;
grant execute on function public.create_partnership_for_me(text, numeric, text, date, jsonb) to authenticated;
