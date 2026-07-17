-- ============================================================
-- MIGRATION 006 — Missing RLS policies for the core money/session tables
--
-- The schema runs `enable row level security` on these tables but never
-- defines a single policy for them. With RLS on and no policy, Postgres
-- denies EVERYTHING — so teacher/parent dashboards, earnings, sessions
-- and withdrawals all silently read back empty. This is why those pages
-- look "basic / no real data".
--
-- Escrow model (no new tables needed):
--   transactions = money taken from the payer and HELD by the platform
--                  (gross_amount, platform_fee, net_amount owed to payee)
--   payouts      = a release of held funds to a teacher/seller, which is
--                  only ever completed by an admin (processed_by/at).
--   A teacher's withdrawable balance = completed transactions where they
--   are payee_id, minus payouts already requested/paid.
--
-- Run once in the Supabase SQL Editor.
-- ============================================================

-- ── helper: is the current user this teacher row's owner? ────
-- teacher_id columns reference teachers(id), not auth.uid().

-- ── TEACHER_REVIEWS ─────────────────────────────────────────
drop policy if exists "Reviews are publicly readable" on public.teacher_reviews;
create policy "Reviews are publicly readable"
  on public.teacher_reviews for select using (true);

drop policy if exists "Reviewer can write their own review" on public.teacher_reviews;
create policy "Reviewer can write their own review"
  on public.teacher_reviews for insert with check (reviewer_id = auth.uid());

drop policy if exists "Admin manages reviews" on public.teacher_reviews;
create policy "Admin manages reviews"
  on public.teacher_reviews for all using (public.get_user_role() = 'admin');

-- ── DEMO_BOOKINGS ───────────────────────────────────────────
drop policy if exists "Parent sees own demo bookings" on public.demo_bookings;
create policy "Parent sees own demo bookings"
  on public.demo_bookings for select using (parent_id = auth.uid());

drop policy if exists "Parent books demos" on public.demo_bookings;
create policy "Parent books demos"
  on public.demo_bookings for insert with check (parent_id = auth.uid());

drop policy if exists "Teacher sees own demo bookings" on public.demo_bookings;
create policy "Teacher sees own demo bookings"
  on public.demo_bookings for select
  using (teacher_id in (select id from public.teachers where user_id = auth.uid()));

drop policy if exists "Teacher updates own demo bookings" on public.demo_bookings;
create policy "Teacher updates own demo bookings"
  on public.demo_bookings for update
  using (teacher_id in (select id from public.teachers where user_id = auth.uid()));

drop policy if exists "Admin manages demo bookings" on public.demo_bookings;
create policy "Admin manages demo bookings"
  on public.demo_bookings for all using (public.get_user_role() = 'admin');

-- ── SUBSCRIPTIONS ───────────────────────────────────────────
drop policy if exists "Parent sees own subscriptions" on public.subscriptions;
create policy "Parent sees own subscriptions"
  on public.subscriptions for select using (parent_id = auth.uid());

drop policy if exists "Teacher sees own subscriptions" on public.subscriptions;
create policy "Teacher sees own subscriptions"
  on public.subscriptions for select
  using (teacher_id in (select id from public.teachers where user_id = auth.uid()));

drop policy if exists "Admin manages subscriptions" on public.subscriptions;
create policy "Admin manages subscriptions"
  on public.subscriptions for all using (public.get_user_role() = 'admin');

-- ── SESSIONS ────────────────────────────────────────────────
drop policy if exists "Parent sees own sessions" on public.sessions;
create policy "Parent sees own sessions"
  on public.sessions for select using (parent_id = auth.uid());

drop policy if exists "Teacher sees own sessions" on public.sessions;
create policy "Teacher sees own sessions"
  on public.sessions for select
  using (teacher_id in (select id from public.teachers where user_id = auth.uid()));

drop policy if exists "Teacher updates own sessions" on public.sessions;
create policy "Teacher updates own sessions"
  on public.sessions for update
  using (teacher_id in (select id from public.teachers where user_id = auth.uid()))
  with check (teacher_id in (select id from public.teachers where user_id = auth.uid()));

drop policy if exists "Admin manages sessions" on public.sessions;
create policy "Admin manages sessions"
  on public.sessions for all using (public.get_user_role() = 'admin');

-- ── STUDENT_PROGRESS ────────────────────────────────────────
-- This table carries teacher_id (-> teachers.id) and parent_id
-- (-> profiles.id) directly; there is no session_id column.
drop policy if exists "Teacher manages progress for own students" on public.student_progress;
create policy "Teacher manages progress for own students"
  on public.student_progress for all
  using (teacher_id in (select id from public.teachers where user_id = auth.uid()))
  with check (teacher_id in (select id from public.teachers where user_id = auth.uid()));

drop policy if exists "Parent sees own child progress" on public.student_progress;
create policy "Parent sees own child progress"
  on public.student_progress for select
  using (parent_id = auth.uid());

drop policy if exists "Admin manages progress" on public.student_progress;
create policy "Admin manages progress"
  on public.student_progress for all using (public.get_user_role() = 'admin');

-- ── TRANSACTIONS (escrow ledger — read-only to users) ───────
drop policy if exists "Users see their own transactions" on public.transactions;
create policy "Users see their own transactions"
  on public.transactions for select
  using (payer_id = auth.uid() or payee_id = auth.uid());

drop policy if exists "Admin manages transactions" on public.transactions;
create policy "Admin manages transactions"
  on public.transactions for all using (public.get_user_role() = 'admin');

-- Money rows are only ever written server-side (service_role bypasses RLS).
revoke insert, update, delete on public.transactions from authenticated, anon;

-- ── PAYOUTS (withdrawal requests + admin release) ───────────
drop policy if exists "Recipient sees own payouts" on public.payouts;
create policy "Recipient sees own payouts"
  on public.payouts for select using (recipient_id = auth.uid());

drop policy if exists "Recipient requests own payout" on public.payouts;
create policy "Recipient requests own payout"
  on public.payouts for insert with check (recipient_id = auth.uid());

-- NOTE: deliberately NO update policy for recipients — only an admin may
-- move a payout's status. That is what makes the escrow release trustworthy.
drop policy if exists "Admin manages payouts" on public.payouts;
create policy "Admin manages payouts"
  on public.payouts for all using (public.get_user_role() = 'admin');

-- Column-level lockdown: a requester may supply only the request fields.
-- `status` falls back to its 'pending' default; approval columns are
-- writable only by admins (gated by the admin-only UPDATE policy above).
revoke insert, update on public.payouts from authenticated, anon;
grant insert (recipient_id, recipient_type, amount, currency, payment_method, bank_name, account_number, iban, notes)
  on public.payouts to authenticated;
grant update (status, processed_by, processed_at, processor_ref, notes)
  on public.payouts to authenticated;
