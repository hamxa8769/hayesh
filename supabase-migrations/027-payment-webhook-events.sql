-- 027: payment webhook idempotency ledger.
-- One row per (provider, event id) so at-least-once webhook delivery
-- never settles the same event twice. Service-role access only.

create table if not exists public.payment_webhook_events (
  provider text not null,
  event_id text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text,
  transaction_id uuid references public.transactions(id) on delete set null,
  primary key (provider, event_id)
);

alter table public.payment_webhook_events enable row level security;

-- No policies on purpose: only the service role (which bypasses RLS) may touch it.
revoke all on public.payment_webhook_events from anon, authenticated;
