-- ============================================================
-- MIGRATION 011 — Assignments, notes, announcements, meetings,
-- saved payment methods, and order deliverables
--
-- These features had no backing tables at all, so none of them were
-- buildable: teachers could not assign homework, leave a private note
-- about a student, or broadcast an announcement; nobody could schedule
-- a video meeting; parents/buyers had no saved payment method to reuse;
-- sellers had no way to attach delivered work to a gig order. This adds:
--   * public.assignments          — teacher -> student homework
--   * public.teacher_notes        — teacher notes about a student
--                                    (optionally private, hidden from parent)
--   * public.announcements        — teacher broadcasts
--   * public.meetings             — scheduled video calls (tutoring or gig)
--   * public.payment_methods      — a user's saved payment instrument
--   * public.order_deliverables   — seller work product against a gig order
--
-- Every new table gets RLS enabled AND a full set of policies in the SAME
-- migration. This codebase has shipped RLS-enabled/zero-policy tables
-- three times before, which silently deny-all and breaks the app. That
-- must not happen again here.
--
-- Write-scope lockdown mostly follows the pattern migrations 001/008/010
-- used: revoke insert/update from authenticated/anon, then grant back
-- only the specific columns a normal user should be able to write.
-- Admin/service writes go through the service-role client, which
-- bypasses grants entirely.
--
-- assignments and meetings are the exception: each has TWO different
-- non-admin `authenticated` actors (teacher + parent; organizer +
-- participant) that can both satisfy RLS on the very same row, just via
-- different ownership columns. A plain column GRANT can't say "actor A
-- may write column X on this row, actor B may not" — it applies to the
-- whole `authenticated` role regardless of which policy let the request
-- through. Those two tables instead use a BEFORE UPDATE trigger keyed off
-- auth.uid(), with the same auth.uid() is null / admin bypass idiom
-- migration 007's validate_payout_request() already established.
--
-- gig_orders buyer column: verified in supabase-schema.sql — the buyer is
-- `public.gig_orders.buyer_id uuid not null references public.profiles(id)`.
-- Used directly below; no guessing required.
--
-- Run once in the Supabase SQL Editor.
-- ============================================================

-- ============================================================
-- 1) ASSIGNMENTS
-- ============================================================
create table if not exists public.assignments (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  title text not null,
  instructions text,
  subject text,
  due_date date,
  attachments jsonb default '[]',
  status text not null default 'assigned',
  submitted_at timestamptz,
  submission_attachments jsonb default '[]',
  grade text,
  feedback text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'assignments_status_check'
  ) then
    alter table public.assignments
      add constraint assignments_status_check
      check (status in ('assigned', 'submitted', 'graded'));
  end if;
end $$;

create index if not exists idx_assignments_student_id on public.assignments(student_id);
create index if not exists idx_assignments_teacher_id on public.assignments(teacher_id);
create index if not exists idx_assignments_status on public.assignments(status);

alter table public.assignments enable row level security;

-- Teacher: full control of their own assignments.
drop policy if exists "Teacher manages own assignments" on public.assignments;
create policy "Teacher manages own assignments"
  on public.assignments for all
  using (teacher_id in (select id from public.teachers where user_id = auth.uid()))
  with check (teacher_id in (select id from public.teachers where user_id = auth.uid()));

-- Parent: may view assignments for their own child.
drop policy if exists "Parent sees child assignments" on public.assignments;
create policy "Parent sees child assignments"
  on public.assignments for select
  using (
    student_id in (select id from public.students where parent_id = auth.uid())
  );

-- Parent: may submit (column grants below restrict which columns).
drop policy if exists "Parent submits child assignments" on public.assignments;
create policy "Parent submits child assignments"
  on public.assignments for update
  using (
    student_id in (select id from public.students where parent_id = auth.uid())
  )
  with check (
    student_id in (select id from public.students where parent_id = auth.uid())
  );

-- Admin: full control.
drop policy if exists "Admin manages assignments" on public.assignments;
create policy "Admin manages assignments"
  on public.assignments for all
  using (public.get_user_role() = 'admin')
  with check (public.get_user_role() = 'admin');

-- Write-scope lockdown: a parent may only ever change submission fields;
-- grading (status='graded', grade, feedback) and assignment content stay
-- teacher/admin-only.
--
-- This can NOT be done with the plain REVOKE/GRANT column-privilege
-- technique used elsewhere in this codebase (migrations 001/008/010),
-- because that technique restricts columns for the whole `authenticated`
-- Postgres role. Here the teacher and the student's parent are BOTH
-- `authenticated` and can BOTH satisfy RLS on the very same assignment
-- row (one via teacher_id ownership, the other via student_id
-- ownership) — a column grant has no way to say "teacher may write
-- grade, parent may not" on a single shared row. A BEFORE UPDATE trigger
-- is used instead, with the same service-role/admin bypass idiom
-- already used in migration 007's validate_payout_request().
create or replace function public.enforce_assignment_write_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Trusted server (service_role, auth.uid() is null) and admins may
  -- change any field.
  if auth.uid() is null or public.get_user_role() = 'admin' then
    return new;
  end if;

  -- The assigning teacher may change any field.
  if exists (
    select 1 from public.teachers
    where id = new.teacher_id and user_id = auth.uid()
  ) then
    return new;
  end if;

  -- Anyone else reaching this row (the student's parent, via the
  -- "Parent submits child assignments" policy) may only change
  -- submission fields; everything else must stay exactly as it was.
  if new.title is distinct from old.title
    or new.instructions is distinct from old.instructions
    or new.subject is distinct from old.subject
    or new.due_date is distinct from old.due_date
    or new.attachments is distinct from old.attachments
    or new.teacher_id is distinct from old.teacher_id
    or new.student_id is distinct from old.student_id
    or new.grade is distinct from old.grade
    or new.feedback is distinct from old.feedback
  then
    raise exception 'Only the assigning teacher may change assignment content or grading fields';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_assignment_write_scope on public.assignments;
create trigger enforce_assignment_write_scope
  before update on public.assignments
  for each row execute function public.enforce_assignment_write_scope();

drop trigger if exists update_assignments_updated_at on public.assignments;
create trigger update_assignments_updated_at
  before update on public.assignments
  for each row execute function public.update_updated_at();


-- ============================================================
-- 2) TEACHER_NOTES
-- ============================================================
create table if not exists public.teacher_notes (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  is_private boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_teacher_notes_parent_id on public.teacher_notes(parent_id);
create index if not exists idx_teacher_notes_student_id on public.teacher_notes(student_id);

alter table public.teacher_notes enable row level security;

-- Teacher: full control of their own notes.
drop policy if exists "Teacher manages own notes" on public.teacher_notes;
create policy "Teacher manages own notes"
  on public.teacher_notes for all
  using (teacher_id in (select id from public.teachers where user_id = auth.uid()))
  with check (teacher_id in (select id from public.teachers where user_id = auth.uid()));

-- Parent: may see only non-private notes addressed to them.
drop policy if exists "Parent sees own non-private notes" on public.teacher_notes;
create policy "Parent sees own non-private notes"
  on public.teacher_notes for select
  using (parent_id = auth.uid() and is_private = false);

-- Admin: full control.
drop policy if exists "Admin manages teacher notes" on public.teacher_notes;
create policy "Admin manages teacher notes"
  on public.teacher_notes for all
  using (public.get_user_role() = 'admin')
  with check (public.get_user_role() = 'admin');

drop trigger if exists update_teacher_notes_updated_at on public.teacher_notes;
create trigger update_teacher_notes_updated_at
  before update on public.teacher_notes
  for each row execute function public.update_updated_at();


-- ============================================================
-- 3) ANNOUNCEMENTS
-- ============================================================
create table if not exists public.announcements (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  audience text not null default 'my_students',
  title text not null,
  body text not null,
  published_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'announcements_audience_check'
  ) then
    alter table public.announcements
      add constraint announcements_audience_check
      check (audience in ('my_students', 'all'));
  end if;
end $$;

create index if not exists idx_announcements_author_id on public.announcements(author_id);

alter table public.announcements enable row level security;

-- Author: full control of their own announcements.
drop policy if exists "Author manages own announcements" on public.announcements;
create policy "Author manages own announcements"
  on public.announcements for all
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

-- Any authenticated user: may see 'all' audience announcements.
drop policy if exists "Everyone sees public announcements" on public.announcements;
create policy "Everyone sees public announcements"
  on public.announcements for select
  using (audience = 'all');

-- Parent: may see 'my_students' announcements from a teacher who is
-- either assigned to one of their children (via student_requests) or
-- has an active subscription with them.
drop policy if exists "Parent sees assigned teacher announcements" on public.announcements;
create policy "Parent sees assigned teacher announcements"
  on public.announcements for select
  using (
    audience = 'my_students'
    and (
      author_id in (
        select t.user_id
        from public.teachers t
        join public.student_requests sr on sr.assigned_teacher_id = t.id
        join public.students s on s.id = sr.student_id
        where s.parent_id = auth.uid()
      )
      or author_id in (
        select t.user_id
        from public.teachers t
        join public.subscriptions sub on sub.teacher_id = t.id
        where sub.parent_id = auth.uid()
      )
    )
  );

-- Admin: full control.
drop policy if exists "Admin manages announcements" on public.announcements;
create policy "Admin manages announcements"
  on public.announcements for all
  using (public.get_user_role() = 'admin')
  with check (public.get_user_role() = 'admin');

drop trigger if exists update_announcements_updated_at on public.announcements;
create trigger update_announcements_updated_at
  before update on public.announcements
  for each row execute function public.update_updated_at();


-- ============================================================
-- 4) MEETINGS
-- ============================================================
create table if not exists public.meetings (
  id uuid primary key default uuid_generate_v4(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  participant_id uuid not null references public.profiles(id) on delete cascade,
  context text not null default 'tutoring',
  related_id uuid,
  title text not null,
  agenda text,
  scheduled_at timestamptz not null,
  duration_minutes smallint default 30,
  room_url text,
  status text not null default 'scheduled',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'meetings_context_check'
  ) then
    alter table public.meetings
      add constraint meetings_context_check
      check (context in ('tutoring', 'gig'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'meetings_status_check'
  ) then
    alter table public.meetings
      add constraint meetings_status_check
      check (status in ('scheduled', 'completed', 'cancelled'));
  end if;
end $$;

-- NOTE: related_id is intentionally NOT a foreign key — it may point at
-- either public.subscriptions or public.gig_orders depending on `context`
-- (polymorphic reference), so it cannot reference a single table.

create index if not exists idx_meetings_organizer_id on public.meetings(organizer_id);
create index if not exists idx_meetings_participant_id on public.meetings(participant_id);
create index if not exists idx_meetings_scheduled_at on public.meetings(scheduled_at);

alter table public.meetings enable row level security;

-- Organizer and participant may both view the meeting.
drop policy if exists "Organizer and participant see meeting" on public.meetings;
create policy "Organizer and participant see meeting"
  on public.meetings for select
  using (organizer_id = auth.uid() or participant_id = auth.uid());

-- Organizer: may create/update/delete their own meetings.
drop policy if exists "Organizer creates meetings" on public.meetings;
create policy "Organizer creates meetings"
  on public.meetings for insert
  with check (organizer_id = auth.uid());

drop policy if exists "Organizer updates own meetings" on public.meetings;
create policy "Organizer updates own meetings"
  on public.meetings for update
  using (organizer_id = auth.uid())
  with check (organizer_id = auth.uid());

drop policy if exists "Organizer deletes own meetings" on public.meetings;
create policy "Organizer deletes own meetings"
  on public.meetings for delete
  using (organizer_id = auth.uid());

-- Participant: may update (write-scope trigger below stops them from
-- changing scheduled_at/status or the participant list).
drop policy if exists "Participant updates own attendance" on public.meetings;
create policy "Participant updates own attendance"
  on public.meetings for update
  using (participant_id = auth.uid())
  with check (participant_id = auth.uid());

-- Admin: full control.
drop policy if exists "Admin manages meetings" on public.meetings;
create policy "Admin manages meetings"
  on public.meetings for all
  using (public.get_user_role() = 'admin')
  with check (public.get_user_role() = 'admin');

-- Write-scope lockdown: the participant must not be able to change
-- scheduled_at/status (or reassign who's on the meeting).
--
-- As with assignments above, this can NOT be done with the plain
-- REVOKE/GRANT column-privilege technique used elsewhere in this
-- codebase, because the organizer and the participant are BOTH
-- `authenticated` and can BOTH satisfy RLS on the very same meeting row
-- (one via organizer_id, the other via participant_id) — a column grant
-- has no way to say "organizer may reschedule, participant may not" on
-- a single shared row. A BEFORE UPDATE trigger is used instead, with the
-- same service-role/admin bypass idiom already used in migration 007's
-- validate_payout_request().
create or replace function public.enforce_meeting_write_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Trusted server (service_role, auth.uid() is null) and admins may
  -- change any field.
  if auth.uid() is null or public.get_user_role() = 'admin' then
    return new;
  end if;

  -- The organizer may change any field.
  if new.organizer_id = auth.uid() then
    return new;
  end if;

  -- Anyone else reaching this row (the participant, via the
  -- "Participant updates own attendance" policy) may only change
  -- title/agenda/room_url — never scheduling, status, or who's on it.
  if new.scheduled_at is distinct from old.scheduled_at
    or new.status is distinct from old.status
    or new.organizer_id is distinct from old.organizer_id
    or new.participant_id is distinct from old.participant_id
    or new.context is distinct from old.context
    or new.related_id is distinct from old.related_id
    or new.duration_minutes is distinct from old.duration_minutes
  then
    raise exception 'Only the organizer may reschedule, change status, or edit meeting participants';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_meeting_write_scope on public.meetings;
create trigger enforce_meeting_write_scope
  before update on public.meetings
  for each row execute function public.enforce_meeting_write_scope();

drop trigger if exists update_meetings_updated_at on public.meetings;
create trigger update_meetings_updated_at
  before update on public.meetings
  for each row execute function public.update_updated_at();


-- ============================================================
-- 5) PAYMENT_METHODS
--
-- SECURITY: account_reference MUST be written already-encrypted by the
-- app layer (AES-256-GCM — see lib/crypto/field-encryption.ts). This
-- column must NEVER contain a plaintext full PAN/card number or raw
-- account number. Only the last 4 digits may ever be stored in plaintext,
-- in account_last4.
-- ============================================================
create table if not exists public.payment_methods (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  method payment_method not null,
  label text,
  account_last4 text,
  account_reference text,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_payment_methods_user_id on public.payment_methods(user_id);

alter table public.payment_methods enable row level security;

-- Owner: full control of their own saved payment methods only.
drop policy if exists "Owner manages own payment methods" on public.payment_methods;
create policy "Owner manages own payment methods"
  on public.payment_methods for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Admin: SELECT only. Admins deliberately cannot create/modify/delete a
-- user's saved payment instruments — this is intentionally not a
-- full-control policy like other tables in this migration.
drop policy if exists "Admin views payment methods" on public.payment_methods;
create policy "Admin views payment methods"
  on public.payment_methods for select
  using (public.get_user_role() = 'admin');

drop trigger if exists update_payment_methods_updated_at on public.payment_methods;
create trigger update_payment_methods_updated_at
  before update on public.payment_methods
  for each row execute function public.update_updated_at();


-- ============================================================
-- 6) ORDER_DELIVERABLES
-- ============================================================
create table if not exists public.order_deliverables (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.gig_orders(id) on delete cascade,
  seller_id uuid not null references public.sellers(id) on delete cascade,
  message text,
  attachments jsonb default '[]',
  is_final boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_order_deliverables_order_id on public.order_deliverables(order_id);

alter table public.order_deliverables enable row level security;

-- Seller: may insert/select their own deliverables.
drop policy if exists "Seller manages own deliverables" on public.order_deliverables;
create policy "Seller manages own deliverables"
  on public.order_deliverables for all
  using (seller_id in (select id from public.sellers where user_id = auth.uid()))
  with check (seller_id in (select id from public.sellers where user_id = auth.uid()));

-- Buyer: may view deliverables for their own gig order.
-- gig_orders.buyer_id (references public.profiles(id)) verified directly
-- in supabase-schema.sql — no guessing.
drop policy if exists "Buyer sees own order deliverables" on public.order_deliverables;
create policy "Buyer sees own order deliverables"
  on public.order_deliverables for select
  using (
    order_id in (select id from public.gig_orders where buyer_id = auth.uid())
  );

-- Admin: full control.
drop policy if exists "Admin manages order deliverables" on public.order_deliverables;
create policy "Admin manages order deliverables"
  on public.order_deliverables for all
  using (public.get_user_role() = 'admin')
  with check (public.get_user_role() = 'admin');
