-- ============================================================
-- MIGRATION 021 — Teacher reviews: one per parent, verified
-- relationship, and live rating aggregates.
--
-- WHY:
--   * teachers.average_rating / total_reviews were never updated, so
--     teacher cards and profiles showed stale/zero ratings.
--   * Any signed-in user could review any teacher (policy only checked
--     reviewer_id = auth.uid()), and could review the same teacher many
--     times (no unique constraint).
--
-- WHAT:
--   1. De-duplicate: if a reviewer already left several reviews for the
--      same teacher, keep ONLY the newest (created_at, then id as the
--      tiebreaker) and delete the older ones. This is destructive for
--      the older duplicate rows but is required to create the unique
--      index; the aggregates are backfilled below.
--   2. Unique index on (teacher_id, reviewer_id).
--   3. SECURITY DEFINER trigger recomputing teachers.average_rating
--      (rounded to 2dp, 0 when no reviews) and total_reviews on
--      insert / update / delete.
--   4. One-time backfill for every teacher.
--   5. Insert policy now requires a real relationship: a subscription
--      (active/past_due/cancelled/paused) or a confirmed/completed demo
--      booking with that teacher. Reviewers may update/delete their own
--      review. The public select policy and the admin policy stay.
--
-- Run once in the Supabase SQL Editor. Idempotent / re-runnable.
-- ============================================================

-- ── 1) Remove older duplicate reviews (keep newest per pair) ─
delete from public.teacher_reviews r
using public.teacher_reviews newer
where r.teacher_id  = newer.teacher_id
  and r.reviewer_id = newer.reviewer_id
  and r.id <> newer.id
  and (
    coalesce(r.created_at, 'epoch'::timestamptz) < coalesce(newer.created_at, 'epoch'::timestamptz)
    or (
      coalesce(r.created_at, 'epoch'::timestamptz) = coalesce(newer.created_at, 'epoch'::timestamptz)
      and r.id < newer.id
    )
  );

-- ── 2) One review per (teacher, reviewer) ───────────────────
create unique index if not exists teacher_reviews_teacher_reviewer_key
  on public.teacher_reviews(teacher_id, reviewer_id);

-- ── 3) Aggregate maintenance trigger ────────────────────────
create or replace function public.refresh_teacher_rating(p_teacher_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.teachers t
     set average_rating = coalesce(
           (select round(avg(r.rating)::numeric, 2) from public.teacher_reviews r where r.teacher_id = p_teacher_id),
           0
         ),
         total_reviews = (select count(*) from public.teacher_reviews r where r.teacher_id = p_teacher_id)
   where t.id = p_teacher_id;
end;
$$;

create or replace function public.teacher_reviews_refresh_aggregates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.refresh_teacher_rating(new.teacher_id);
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.teacher_id is distinct from new.teacher_id) then
    perform public.refresh_teacher_rating(old.teacher_id);
  end if;
  return null;
end;
$$;

-- Internal helper only; never callable from the API.
revoke all on function public.refresh_teacher_rating(uuid) from public, anon, authenticated;
revoke all on function public.teacher_reviews_refresh_aggregates() from public, anon, authenticated;

drop trigger if exists teacher_reviews_refresh_aggregates on public.teacher_reviews;
create trigger teacher_reviews_refresh_aggregates
  after insert or update or delete on public.teacher_reviews
  for each row execute function public.teacher_reviews_refresh_aggregates();

-- ── 4) Backfill every teacher (also zeroes teachers with none) ─
update public.teachers t
   set average_rating = coalesce(
         (select round(avg(r.rating)::numeric, 2) from public.teacher_reviews r where r.teacher_id = t.id),
         0
       ),
       total_reviews = (select count(*) from public.teacher_reviews r where r.teacher_id = t.id);

-- ── 5) RLS policies ─────────────────────────────────────────
-- Public select ("Reviews are publicly readable") and the admin policy
-- ("Admin manages reviews") from migration 006 are left untouched.

-- Who may review a teacher: a parent with a tuition enrolment, or one whose
-- demo lesson actually took place ('completed' — a merely confirmed free demo
-- is not enough). Used by BOTH insert and update so a review can never be
-- re-pointed (teacher_id changed) at a teacher the reviewer never had.
create or replace function public.can_review_teacher(p_teacher_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions s
     where s.teacher_id = p_teacher_id
       and s.parent_id  = auth.uid()
       and s.status::text in ('active', 'past_due', 'cancelled', 'paused')
  ) or exists (
    select 1 from public.demo_bookings d
     where d.teacher_id = p_teacher_id
       and d.parent_id  = auth.uid()
       and d.status = 'completed'
  );
$$;

revoke all on function public.can_review_teacher(uuid) from public, anon;
grant execute on function public.can_review_teacher(uuid) to authenticated;

drop policy if exists "Reviewer can write their own review" on public.teacher_reviews;
drop policy if exists "Verified parent can write their own review" on public.teacher_reviews;
create policy "Verified parent can write their own review"
  on public.teacher_reviews for insert
  with check (reviewer_id = auth.uid() and public.can_review_teacher(teacher_id));

drop policy if exists "Reviewer can update their own review" on public.teacher_reviews;
create policy "Reviewer can update their own review"
  on public.teacher_reviews for update
  using (reviewer_id = auth.uid())
  with check (reviewer_id = auth.uid() and public.can_review_teacher(teacher_id));

drop policy if exists "Reviewer can delete their own review" on public.teacher_reviews;
create policy "Reviewer can delete their own review"
  on public.teacher_reviews for delete
  using (reviewer_id = auth.uid());
