-- ============================================================
-- MIGRATION 007 — Server-side escrow guard on withdrawal requests
--
-- WHY: the withdrawal amount was only validated in the browser (zod,
-- against a client-side balance snapshot). The client talks to Supabase
-- with the anon key + the user's JWT, so a teacher/seller could POST
-- straight to /rest/v1/payouts and request ANY amount — more than they
-- earned, or a negative one — bypassing the UI entirely. RLS checks WHO
-- you are, never HOW MUCH. Two tabs could also both pass a stale
-- "amount <= available" check and double-claim the same escrow balance
-- (TOCTOU).
--
-- This makes the database the source of truth for the escrow release:
--   available(currency) = SUM(transactions.net_amount) where the user is
--                         payee_id AND status='completed'
--                       - SUM(payouts.amount) already claimed
--                         (status <> 'failed')
-- Concurrent requests for the same recipient are serialized with a
-- transaction-scoped advisory lock, so two tabs cannot both slip through.
--
-- Run once in the Supabase SQL Editor.
-- ============================================================

-- Defense in depth: no zero/negative payouts, ever.
alter table public.payouts drop constraint if exists payouts_amount_positive;
alter table public.payouts add constraint payouts_amount_positive check (amount > 0);

create or replace function public.validate_payout_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_earned    numeric;
  v_claimed   numeric;
  v_available numeric;
begin
  if new.amount is null or new.amount <= 0 then
    raise exception 'Withdrawal amount must be greater than zero';
  end if;

  -- Trusted server (service_role, auth.uid() is null) and admins may
  -- create payouts directly; the CHECK above still applies to them.
  if auth.uid() is null or public.get_user_role() = 'admin' then
    return new;
  end if;

  -- Serialize concurrent requests for this recipient so two in-flight
  -- inserts can't each read the same pre-claim balance and both pass.
  perform pg_advisory_xact_lock(hashtext(new.recipient_id::text));

  select coalesce(sum(net_amount), 0) into v_earned
  from public.transactions
  where payee_id = new.recipient_id
    and status = 'completed'
    and currency = new.currency;

  select coalesce(sum(amount), 0) into v_claimed
  from public.payouts
  where recipient_id = new.recipient_id
    and currency = new.currency
    and status <> 'failed';

  v_available := v_earned - v_claimed;

  if new.amount > v_available then
    raise exception
      'Withdrawal of % % exceeds available balance of % %',
      new.amount, new.currency, v_available, new.currency;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_payout_before_insert on public.payouts;
create trigger validate_payout_before_insert
  before insert on public.payouts
  for each row execute function public.validate_payout_request();
