-- ============================================================
-- MIGRATION 019 — Commerce core: checkout, payment verification,
-- gig order lifecycle, escrow, monthly tuition renewals.
--
-- WHY: every "buy" button (AI "Order Now", gig "Place Order", tuition
-- enrolment) was a placeholder — no order, transaction or payment was
-- ever created, and gig_orders had RLS enabled with NO policies (so
-- buyer/seller order pages always rendered empty).
--
-- Money model (all writes go through server routes with the service-role
-- client; browsers can only READ their own rows):
--   transactions.status
--     pending    → created at checkout; awaiting payment. If
--                  bank_transfer_proof is set, it is awaiting ADMIN
--                  verification (manual bank / JazzCash / Easypaisa rail).
--     processing → paid, HELD in escrow (gig orders until the buyer
--                  accepts delivery). Not withdrawable (payout guard in
--                  migration 007 only counts 'completed').
--     completed  → paid and settled; payee's net_amount is withdrawable.
--     failed     → payment rejected / abandoned.
--     refunded   → refunded after a dispute.
--
-- Run once in the Supabase SQL Editor. Idempotent / re-runnable.
-- ============================================================

-- ── Enum: tuition subscriptions wait for their first payment ─
alter type subscription_status add value if not exists 'pending_payment';

-- ── transactions: checkout bookkeeping columns ──────────────
alter table public.transactions add column if not exists reference_code   text;
alter table public.transactions add column if not exists payer_reference  text;   -- payer's bank / wallet transaction id
alter table public.transactions add column if not exists proof_submitted_at timestamptz;
alter table public.transactions add column if not exists rejection_reason text;
alter table public.transactions add column if not exists description      text;   -- human summary shown on checkout
alter table public.transactions add column if not exists meta             jsonb not null default '{}';
alter table public.transactions add column if not exists updated_at       timestamptz default now();

create unique index if not exists transactions_reference_code_key
  on public.transactions(reference_code) where reference_code is not null;
create index if not exists idx_transactions_status_created
  on public.transactions(status, created_at desc);
create index if not exists idx_transactions_payer on public.transactions(payer_id);
create index if not exists idx_transactions_payee on public.transactions(payee_id);
create index if not exists idx_transactions_gig_order on public.transactions(gig_order_id);
create index if not exists idx_transactions_ai_order on public.transactions(ai_order_id);
create index if not exists idx_transactions_subscription on public.transactions(subscription_id);

-- Amounts can never be negative.
alter table public.transactions drop constraint if exists transactions_amounts_nonnegative;
alter table public.transactions add constraint transactions_amounts_nonnegative
  check (gross_amount >= 0 and net_amount >= 0 and coalesce(platform_fee, 0) >= 0);

-- ── subscriptions: link to a student record (optional) ──────
alter table public.subscriptions add column if not exists student_id uuid references public.students(id) on delete set null;
create index if not exists idx_subscriptions_period_end on public.subscriptions(current_period_end);

-- ── gig_orders: buyer can see the gig title without a join ──
alter table public.gig_orders add column if not exists gig_title text;
alter table public.gig_orders add column if not exists accepted_at timestamptz;
create index if not exists idx_gig_orders_buyer on public.gig_orders(buyer_id);
create index if not exists idx_gig_orders_seller on public.gig_orders(seller_id);
create index if not exists idx_gig_orders_status on public.gig_orders(status);
create index if not exists idx_ai_orders_buyer on public.ai_orders(buyer_id);

-- ── gig_orders RLS: buyer + owning seller + admin can read ──
drop policy if exists "Gig order parties can read" on public.gig_orders;
create policy "Gig order parties can read"
  on public.gig_orders for select
  using (
    buyer_id = auth.uid()
    or seller_id in (select s.id from public.sellers s where s.user_id = auth.uid())
    or public.get_user_role() = 'admin'
  );

drop policy if exists "Admin manages gig orders" on public.gig_orders;
create policy "Admin manages gig orders"
  on public.gig_orders for all
  using (public.get_user_role() = 'admin')
  with check (public.get_user_role() = 'admin');

-- Every order-state change (pay, deliver, accept, dispute) is a server
-- route; browsers may never write orders or subscriptions directly.
revoke insert, update, delete on public.gig_orders from anon, authenticated;
revoke insert, update, delete on public.subscriptions from anon, authenticated;
-- AI orders are now created by /api/checkout (server) too.
revoke insert on public.ai_orders from anon, authenticated;

-- ── Platform payment-account settings (shown on checkout) ───
insert into public.platform_settings (key, value, description) values
  ('payment_bank_name',        '""', 'Bank name customers transfer to'),
  ('payment_account_title',    '""', 'Bank account title'),
  ('payment_account_number',   '""', 'Bank account number'),
  ('payment_iban',             '""', 'Bank IBAN'),
  ('payment_jazzcash_number',  '""', 'JazzCash wallet number customers pay to'),
  ('payment_easypaisa_number', '""', 'Easypaisa wallet number customers pay to'),
  ('payment_instructions',     '""', 'Extra payment instructions shown at checkout'),
  ('gig_auto_complete_days',   '3',  'Days after delivery before a gig order auto-completes')
on conflict (key) do nothing;

-- ── Private bucket for payment proof screenshots ────────────
-- Path convention: "<payer user id>/<transaction id>/<filename>".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880,
        array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

drop policy if exists "payment-proofs owner write" on storage.objects;
create policy "payment-proofs owner write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "payment-proofs read" on storage.objects;
create policy "payment-proofs read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.get_user_role() = 'admin'
    )
  );
