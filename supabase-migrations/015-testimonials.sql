-- ============================================================
-- MIGRATION 015 — admin-curated testimonials + "Hayesh Verified" endorsement
--
-- Lets an admin write/edit testimonials shown on teacher and seller profiles,
-- and grant a platform endorsement badge. This is deliberately SEPARATE from
-- public.teacher_reviews (which are reviews left by real signed-in parents):
--   * a testimonial carries an EXPLICIT author name the admin types in, and a
--     `source` marking it as admin-authored or an imported real quote. It is
--     never presented as if a specific logged-in user left it.
--   * teacher_reviews stay the authentic signal; testimonials are editorial
--     curation, rendered as clearly attributed quotes.
--
-- Also adds teachers.endorsed / sellers.endorsed for the "Hayesh Verified"
-- badge the endorsements panel had stubbed out as needs-a-migration.
--
-- Run once in the Supabase SQL Editor. Idempotent / re-runnable.
-- ============================================================

-- ── endorsement badge columns ───────────────────────────────
alter table public.teachers add column if not exists endorsed boolean default false;
alter table public.sellers  add column if not exists endorsed boolean default false;

-- ── testimonials ────────────────────────────────────────────
create table if not exists public.testimonials (
  id            uuid primary key default uuid_generate_v4(),
  subject_type  text not null,                 -- 'teacher' | 'seller'
  subject_id    uuid not null,                 -- teachers.id or sellers.id (polymorphic, no FK)
  author_name   text not null,
  author_role   text,                          -- e.g. "Parent", "Buyer", "Verified client"
  rating        smallint check (rating between 1 and 5),
  body          text not null,
  source        text not null default 'admin', -- 'admin' (written by staff) | 'imported' (real quote entered by staff)
  is_published  boolean default true,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'testimonials_subject_type_check') then
    alter table public.testimonials
      add constraint testimonials_subject_type_check check (subject_type in ('teacher', 'seller'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'testimonials_source_check') then
    alter table public.testimonials
      add constraint testimonials_source_check check (source in ('admin', 'imported'));
  end if;
end $$;

create index if not exists idx_testimonials_subject on public.testimonials(subject_type, subject_id);

alter table public.testimonials enable row level security;

-- Public may read published testimonials; admin manages everything.
drop policy if exists "Public reads published testimonials" on public.testimonials;
create policy "Public reads published testimonials"
  on public.testimonials for select
  using (is_published = true or public.get_user_role() = 'admin');

drop policy if exists "Admin manages testimonials" on public.testimonials;
create policy "Admin manages testimonials"
  on public.testimonials for all
  using (public.get_user_role() = 'admin')
  with check (public.get_user_role() = 'admin');

-- updated_at trigger (function already exists in the base schema).
drop trigger if exists update_testimonials_updated_at on public.testimonials;
create trigger update_testimonials_updated_at
  before update on public.testimonials
  for each row execute function public.update_updated_at();
