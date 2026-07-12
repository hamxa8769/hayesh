-- ============================================================
-- MIGRATION 005 — Row-Level Security policies for `sellers`
--
-- The schema enables RLS on public.sellers but never defined any
-- policy, so EVERY read/write of a seller's own row is blocked — the
-- seller dashboard, profile, and gig-creation (which must look up
-- sellers.id) silently get nothing back. This mirrors the policy set
-- the `teachers` table already has.
--
-- Run once in the Supabase SQL Editor.
-- ============================================================

-- Public can see approved sellers (marketplace / seller profiles).
drop policy if exists "Approved sellers visible to everyone" on public.sellers;
create policy "Approved sellers visible to everyone"
  on public.sellers for select
  using (status = 'approved');

-- A seller can read their own row regardless of approval status.
drop policy if exists "Seller can view their own row" on public.sellers;
create policy "Seller can view their own row"
  on public.sellers for select
  using (user_id = auth.uid());

-- A seller can create their own seller row.
drop policy if exists "Seller can insert their own row" on public.sellers;
create policy "Seller can insert their own row"
  on public.sellers for insert
  with check (user_id = auth.uid());

-- A seller can update their own row (only editable profile columns;
-- approval status / level / fees / stats stay admin-only via the
-- column grants below).
drop policy if exists "Seller can update their own row" on public.sellers;
create policy "Seller can update their own row"
  on public.sellers for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Admin can do everything.
drop policy if exists "Admin can do everything with sellers" on public.sellers;
create policy "Admin can do everything with sellers"
  on public.sellers for all
  using (public.get_user_role() = 'admin');

-- Column-level protection: sellers may edit profile fields only, never
-- their own approval status / level / registration-fee / stats.
revoke insert, update on public.sellers from authenticated, anon;
grant insert (user_id, display_name, tagline, avatar_url, portfolio_urls, skills, languages, response_time_hrs)
  on public.sellers to authenticated;
grant update (display_name, tagline, avatar_url, portfolio_urls, skills, languages, response_time_hrs, is_online, last_seen_at)
  on public.sellers to authenticated;
