-- ============================================================
-- MIGRATION 008 — Let teachers create their own row (onboarding)
--
-- BUG: completing teacher onboarding fails with
--   "new row violates row-level security policy for table teachers"
-- The teachers table has SELECT / UPDATE / admin-ALL policies but NO
-- INSERT policy, so a teacher cannot create their own row.
--
-- Also closes a latent privilege hole: INSERT column privileges were
-- never restricted, so a teacher could insert status='approved' /
-- featured=true and self-approve. This grants INSERT only on the
-- onboarding-writable columns (status, approval, fees, featuring, stats,
-- and translation_enabled stay admin-only, via the service-role path).
--
-- Run once in the Supabase SQL Editor.
-- ============================================================

-- A teacher may create exactly their own row.
drop policy if exists "Teacher can create their own row" on public.teachers;
create policy "Teacher can create their own row"
  on public.teachers for insert
  with check (user_id = auth.uid());

-- Restrict which columns a client may write on INSERT. New teacher rows
-- therefore get status='pending' (the table default) and cannot be
-- self-approved / self-featured. Admin approval and stats go through the
-- service-role client, which bypasses these grants.
revoke insert on public.teachers from authenticated, anon;
grant insert (
  user_id, display_name, tagline, intro_video_url, profile_photo_url,
  education, experience, subjects, availability,
  group_price_pkr, group_price_usd,
  standard_price_pkr, standard_price_usd,
  private_price_pkr, private_price_usd,
  translation_languages
) on public.teachers to authenticated;
