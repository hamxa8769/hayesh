-- ============================================================
-- MIGRATION 022 — Featured listings (paid placement for teachers
-- and sellers).
--
-- Teachers/sellers buy a 7- or 30-day featured slot through the normal
-- checkout (transactions.type = 'featured'). Settlement (lib/payments/
-- settle.ts) sets featured = true and extends featured_until; the daily
-- commerce cron clears expired flags. Listing pages order unexpired
-- featured rows first.
--
-- Prices live in platform_settings (PKR) and are editable by the admin.
--
-- Run once in the Supabase SQL Editor. Idempotent / re-runnable.
-- ============================================================

-- teachers already have featured + featured_until; guard anyway.
alter table public.teachers add column if not exists featured       boolean default false;
alter table public.teachers add column if not exists featured_until timestamptz;

alter table public.sellers  add column if not exists featured       boolean default false;
alter table public.sellers  add column if not exists featured_until timestamptz;

create index if not exists idx_teachers_featured on public.teachers(featured, featured_until);
create index if not exists idx_sellers_featured_until on public.sellers(featured_until);

-- Default prices (PKR). Values are jsonb strings like the other fee rows.
insert into public.platform_settings (key, value, description) values
  ('featured_7d_price_pkr',  '1500', 'Price of a 7-day featured listing (PKR)'),
  ('featured_30d_price_pkr', '5000', 'Price of a 30-day featured listing (PKR)')
on conflict (key) do nothing;
