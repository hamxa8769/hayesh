-- 028 — Performance indexes for the hottest dashboard / list queries.
--
-- Every index matches a real query pattern in the app (dashboard lists
-- filtered by owner + status and ordered by date, unread counters, the admin
-- verification queue, scheduling lookups). Composite/partial indexes replace
-- full scans once tables grow past a few thousand rows. Idempotent.
--
-- On a large live table you can run each statement as
-- `create index concurrently …` one at a time instead (concurrently cannot
-- run inside a transaction). At launch-size tables the plain form is instant.

-- Orders: "my orders" lists for buyers and sellers, newest first, by status.
create index if not exists idx_gig_orders_buyer_status_created
  on public.gig_orders (buyer_id, status, created_at desc);
create index if not exists idx_gig_orders_seller_status_created
  on public.gig_orders (seller_id, status, created_at desc);
-- Cron: auto-complete delivered orders after N days.
create index if not exists idx_gig_orders_delivered_at
  on public.gig_orders (delivered_at) where status = 'delivered';

create index if not exists idx_ai_orders_buyer_created
  on public.ai_orders (buyer_id, created_at desc);

-- Money: earnings / withdrawable balance per payee, and the admin queue of
-- payments awaiting verification (oldest first).
create index if not exists idx_transactions_payee_status
  on public.transactions (payee_id, status);
create index if not exists idx_transactions_payer_created
  on public.transactions (payer_id, created_at desc);
create index if not exists idx_transactions_pending_created
  on public.transactions (created_at) where status = 'pending';

create index if not exists idx_payouts_recipient_created
  on public.payouts (recipient_id, created_at desc);
create index if not exists idx_payouts_status_created
  on public.payouts (status, created_at);

-- Notifications bell: unread for a user, newest first.
create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, created_at desc) where read = false;
create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

-- Messaging: unread counts per receiver; inbox ordering.
create index if not exists idx_messages_receiver_unread
  on public.messages (receiver_id) where read = false;
create index if not exists idx_conversations_last_message
  on public.conversations (last_message_at desc);

-- Scheduling: teacher / parent calendars and the "upcoming" widgets.
create index if not exists idx_sessions_teacher_scheduled
  on public.sessions (teacher_id, scheduled_at);
create index if not exists idx_sessions_parent_scheduled
  on public.sessions (parent_id, scheduled_at);
create index if not exists idx_demo_bookings_teacher_scheduled
  on public.demo_bookings (teacher_id, scheduled_at);
create index if not exists idx_demo_bookings_parent_scheduled
  on public.demo_bookings (parent_id, scheduled_at);

-- Tuition renewals: active plans by period end (cron).
create index if not exists idx_subscriptions_status_period_end
  on public.subscriptions (status, current_period_end);

-- Public catalogue: approved gigs by category, newest / featured first.
create index if not exists idx_gigs_approved_category_created
  on public.gigs (category, created_at desc) where status = 'approved';
create index if not exists idx_gigs_featured_until
  on public.gigs (featured_until) where is_featured;

-- Teacher reviews listing on the public profile.
create index if not exists idx_teacher_reviews_teacher_created
  on public.teacher_reviews (teacher_id, created_at desc);

analyze public.gig_orders, public.transactions, public.notifications, public.messages,
        public.sessions, public.demo_bookings, public.gigs, public.payouts;
