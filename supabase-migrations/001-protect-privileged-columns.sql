-- ============================================================
-- MIGRATION 001 — Protect privileged columns from client writes
-- Fixes CRITICAL finding: self-service UPDATE policies had no
-- column restrictions, letting any user set profiles.role='admin',
-- teachers self-approve (status), self-enable translation, mark
-- fees paid, or sellers self-approve/feature gigs.
--
-- Approach: column-level grants. RLS policies limit WHICH ROWS a
-- user may touch; these grants limit WHICH COLUMNS. The
-- service_role key keeps full access, so all privileged mutations
-- (approvals, fees, featuring, translation, role changes) MUST go
-- through lib/supabase/admin.ts in server code after verifying the
-- caller is an admin. Admin dashboards must NOT write these columns
-- through the user-session client.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

-- ── PROFILES ────────────────────────────────────────────────
-- Users may edit their own identity fields, never role/verification.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, avatar_url, phone, country, city, bio)
  on public.profiles to authenticated;

-- Harden the policy with WITH CHECK (row identity can't change)
drop policy "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── TEACHERS ────────────────────────────────────────────────
-- Teachers may edit profile content and pricing, never approval
-- status, translation privileges, featuring, fees, or stats.
revoke update on public.teachers from authenticated, anon;
grant update (
  display_name, tagline, intro_video_url, profile_photo_url,
  education, experience, subjects, availability,
  group_price_pkr, group_price_usd,
  standard_price_pkr, standard_price_usd,
  private_price_pkr, private_price_usd
) on public.teachers to authenticated;

drop policy "Teacher can update their own profile" on public.teachers;
create policy "Teacher can update their own profile"
  on public.teachers for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── GIGS ────────────────────────────────────────────────────
-- Sellers may create/edit gig content and packages, never approval
-- status, featuring, or stats (applies to INSERT as well, so a new
-- gig can't be born pre-approved or pre-featured).
revoke insert, update on public.gigs from authenticated, anon;
grant insert (
  seller_id, title, category, subcategory, description, tags,
  gallery_urls, faq,
  basic_title, basic_description, basic_price_pkr, basic_price_usd,
  basic_delivery_days, basic_revisions, basic_features,
  standard_title, standard_description, standard_price_pkr,
  standard_price_usd, standard_delivery_days, standard_revisions,
  standard_features,
  premium_title, premium_description, premium_price_pkr,
  premium_price_usd, premium_delivery_days, premium_revisions,
  premium_features
) on public.gigs to authenticated;
grant update (
  title, category, subcategory, description, tags,
  gallery_urls, faq,
  basic_title, basic_description, basic_price_pkr, basic_price_usd,
  basic_delivery_days, basic_revisions, basic_features,
  standard_title, standard_description, standard_price_pkr,
  standard_price_usd, standard_delivery_days, standard_revisions,
  standard_features,
  premium_title, premium_description, premium_price_pkr,
  premium_price_usd, premium_delivery_days, premium_revisions,
  premium_features
) on public.gigs to authenticated;
