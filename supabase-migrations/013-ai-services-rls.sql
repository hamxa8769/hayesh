-- ============================================================
-- MIGRATION 013 — RLS for ai_services + ai_orders
--
-- Both tables had RLS ENABLED but ZERO policies (deny-all), so the AI
-- services feature could never read or write anything. This adds the full
-- policy set.
--
-- The single most important rule: ai_services.system_prompt is the admin's
-- private agent configuration and must NEVER be exposed to a buyer. Row
-- policies cannot hide a single column, so this uses a COLUMN-LEVEL grant:
-- SELECT is revoked wholesale from anon/authenticated and re-granted on every
-- column EXCEPT system_prompt. A client that selects system_prompt gets
-- "permission denied"; the admin reads it through a service-role route, which
-- bypasses these grants.
--
-- Run once in the Supabase SQL Editor. Idempotent / re-runnable.
-- ============================================================

-- ── ai_services: hide system_prompt at the column level ─────
revoke select on public.ai_services from anon, authenticated;
grant select (
  id, title, description, category, thumbnail_url, status,
  price_pkr, price_usd, ai_model, output_format, delivery_time_hrs,
  input_schema, revisions_allowed, total_orders, average_rating,
  total_reviews, created_at, updated_at
) on public.ai_services to anon, authenticated;

-- Row policy: everyone may read ACTIVE services; admin sees all statuses.
drop policy if exists "Public sees active AI services" on public.ai_services;
create policy "Public sees active AI services"
  on public.ai_services for select
  using (status = 'active' or public.get_user_role() = 'admin');

-- Admin manages services (also runs via service role, which bypasses RLS;
-- this policy exists so the deny-all default doesn't block a service that a
-- future admin-authenticated path might use).
drop policy if exists "Admin manages AI services" on public.ai_services;
create policy "Admin manages AI services"
  on public.ai_services for all
  using (public.get_user_role() = 'admin')
  with check (public.get_user_role() = 'admin');

-- ── ai_orders: buyer owns their orders, cannot self-fulfil ──
drop policy if exists "Buyer sees own AI orders" on public.ai_orders;
create policy "Buyer sees own AI orders"
  on public.ai_orders for select
  using (buyer_id = auth.uid() or public.get_user_role() = 'admin');

drop policy if exists "Buyer creates own AI orders" on public.ai_orders;
create policy "Buyer creates own AI orders"
  on public.ai_orders for insert
  with check (buyer_id = auth.uid());

drop policy if exists "Admin manages AI orders" on public.ai_orders;
create policy "Admin manages AI orders"
  on public.ai_orders for all
  using (public.get_user_role() = 'admin')
  with check (public.get_user_role() = 'admin');

-- A buyer may create an order but must NOT be able to write the fulfilment
-- columns (ai_output, status, fulfilled_at, model_used) — the Claude
-- fulfilment runs server-side with the service-role client. Restrict the
-- client-writable columns the same way the other migrations do.
revoke insert, update on public.ai_orders from anon, authenticated;
grant insert (
  service_id, buyer_id, user_inputs, amount_pkr, amount_usd,
  currency, payment_method
) on public.ai_orders to authenticated;
-- Allow a buyer to attach a rating/review to their own order (nothing else).
grant update (rating, review) on public.ai_orders to authenticated;
