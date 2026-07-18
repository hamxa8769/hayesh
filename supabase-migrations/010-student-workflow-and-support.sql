-- ============================================================
-- MIGRATION 010 — Student records, tutoring requests, and support tickets
--
-- Three problems this closes:
--
-- 1. Children only exist today as a denormalized `child_name text` on
--    `subscriptions` / `student_progress`. There is no real student
--    record a parent (or admin) can create ahead of a subscription, and
--    no way to request tutoring for a child before a teacher is
--    assigned. This adds:
--      * public.students          — a parent's child as a real row
--      * public.student_requests  — parent asks for tutoring in a
--        subject; admin reviews and assigns a teacher
--
-- 2. There is no support/helpdesk surface for teachers (or any user) to
--    raise an issue and have admin respond. This adds:
--      * public.support_tickets
--      * public.support_ticket_messages (the thread, with admin-only
--        internal notes)
--
-- 3. Every new table gets RLS enabled AND a full set of policies in the
--    SAME migration. This codebase has shipped RLS-enabled/zero-policy
--    tables three times before, which silently deny-all and break the
--    app. That must not happen again here.
--
-- Column-privilege lockdown follows the pattern migration 008 used for
-- `teachers`: revoke insert/update from authenticated/anon, then grant
-- back only the specific columns a normal user should be able to write.
-- Admin writes (assignment, status changes, ticket routing) go through
-- the service-role client, which bypasses grants entirely.
--
-- Run once in the Supabase SQL Editor.
-- ============================================================

-- ============================================================
-- 1) STUDENTS
-- ============================================================
create table if not exists public.students (
  id uuid primary key default uuid_generate_v4(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  date_of_birth date,
  grade_level text,
  notes text,
  created_by uuid references public.profiles(id),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_students_parent_id on public.students(parent_id);

alter table public.students enable row level security;

-- Parent: full control of their own children.
drop policy if exists "Parent manages own students" on public.students;
create policy "Parent manages own students"
  on public.students for all
  using (parent_id = auth.uid())
  with check (parent_id = auth.uid());

-- Admin: full control of all students.
drop policy if exists "Admin manages students" on public.students;
create policy "Admin manages students"
  on public.students for all
  using (public.get_user_role() = 'admin')
  with check (public.get_user_role() = 'admin');

-- NOTE: the "Teacher sees assigned students" policy is created further
-- down, AFTER public.student_requests exists (a policy's USING clause is
-- checked against the catalog at creation time, so the table it
-- references must already exist).

drop trigger if exists update_students_updated_at on public.students;
create trigger update_students_updated_at
  before update on public.students
  for each row execute function public.update_updated_at();


-- ============================================================
-- 2) STUDENT_REQUESTS
-- ============================================================
create table if not exists public.student_requests (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.students(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  preferred_tier text,
  notes text,
  status text not null default 'open',
  assigned_teacher_id uuid references public.teachers(id) on delete set null,
  assigned_by uuid references public.profiles(id),
  assigned_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'student_requests_status_check'
  ) then
    alter table public.student_requests
      add constraint student_requests_status_check
      check (status in ('open', 'assigned', 'declined', 'cancelled'));
  end if;
end $$;

create index if not exists idx_student_requests_parent_id on public.student_requests(parent_id);
create index if not exists idx_student_requests_status on public.student_requests(status);
create index if not exists idx_student_requests_assigned_teacher_id on public.student_requests(assigned_teacher_id);

alter table public.student_requests enable row level security;

-- Parent: full control of their own requests (column grants below stop
-- them from touching assignment/status fields directly).
drop policy if exists "Parent manages own student requests" on public.student_requests;
create policy "Parent manages own student requests"
  on public.student_requests for all
  using (parent_id = auth.uid())
  with check (parent_id = auth.uid());

-- Admin: full control.
drop policy if exists "Admin manages student requests" on public.student_requests;
create policy "Admin manages student requests"
  on public.student_requests for all
  using (public.get_user_role() = 'admin')
  with check (public.get_user_role() = 'admin');

-- Teacher: may see requests assigned to them.
drop policy if exists "Teacher sees assigned requests" on public.student_requests;
create policy "Teacher sees assigned requests"
  on public.student_requests for select
  using (
    assigned_teacher_id in (select id from public.teachers where user_id = auth.uid())
  );

-- Column-level lockdown: a parent may create a request and edit only the
-- request-content fields; they cannot set who it's assigned to, who
-- assigned it, when, or its status via UPDATE (status stays at its
-- 'open' default until admin acts via the service-role client).
--
-- "Cancel" is intentionally NOT an UPDATE-to-status path (that would let
-- a parent flip status to anything, since column grants can't restrict
-- by value). Instead a parent cancels by deleting their own open request
-- outright — the "Parent manages own student requests" policy above is
-- `for all`, so DELETE on their own rows (parent_id = auth.uid()) is
-- already permitted and untouched by these revokes.
revoke insert, update on public.student_requests from authenticated, anon;
grant insert (student_id, parent_id, subject, preferred_tier, notes)
  on public.student_requests to authenticated;
grant update (subject, preferred_tier, notes)
  on public.student_requests to authenticated;

drop trigger if exists update_student_requests_updated_at on public.student_requests;
create trigger update_student_requests_updated_at
  before update on public.student_requests
  for each row execute function public.update_updated_at();

-- Now that public.student_requests exists, add the deferred students
-- policy: a teacher may view a student only if that student has a
-- request assigned to them.
drop policy if exists "Teacher sees assigned students" on public.students;
create policy "Teacher sees assigned students"
  on public.students for select
  using (
    id in (
      select sr.student_id
      from public.student_requests sr
      join public.teachers t on t.id = sr.assigned_teacher_id
      where t.user_id = auth.uid()
    )
  );


-- ============================================================
-- 3) SUPPORT_TICKETS
-- ============================================================
create table if not exists public.support_tickets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  category text,
  status text not null default 'open',
  priority text not null default 'normal',
  assigned_admin_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  resolved_at timestamptz
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'support_tickets_status_check'
  ) then
    alter table public.support_tickets
      add constraint support_tickets_status_check
      check (status in ('open', 'pending', 'resolved', 'closed'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'support_tickets_priority_check'
  ) then
    alter table public.support_tickets
      add constraint support_tickets_priority_check
      check (priority in ('low', 'normal', 'high'));
  end if;
end $$;

create index if not exists idx_support_tickets_user_id on public.support_tickets(user_id);
create index if not exists idx_support_tickets_status on public.support_tickets(status);

alter table public.support_tickets enable row level security;

-- Owner: select/insert their own; update limited to subject/category via
-- column grants below (status/priority/assignment stay admin-only).
drop policy if exists "Owner sees own tickets" on public.support_tickets;
create policy "Owner sees own tickets"
  on public.support_tickets for select
  using (user_id = auth.uid());

drop policy if exists "Owner creates own tickets" on public.support_tickets;
create policy "Owner creates own tickets"
  on public.support_tickets for insert
  with check (user_id = auth.uid());

drop policy if exists "Owner updates own tickets" on public.support_tickets;
create policy "Owner updates own tickets"
  on public.support_tickets for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Admin: full control.
drop policy if exists "Admin manages tickets" on public.support_tickets;
create policy "Admin manages tickets"
  on public.support_tickets for all
  using (public.get_user_role() = 'admin')
  with check (public.get_user_role() = 'admin');

-- Column-level lockdown: owner cannot set assigned_admin_id, status, or
-- priority themselves.
revoke insert, update on public.support_tickets from authenticated, anon;
grant insert (user_id, subject, category)
  on public.support_tickets to authenticated;
grant update (subject, category)
  on public.support_tickets to authenticated;

drop trigger if exists update_support_tickets_updated_at on public.support_tickets;
create trigger update_support_tickets_updated_at
  before update on public.support_tickets
  for each row execute function public.update_updated_at();


-- ============================================================
-- 4) SUPPORT_TICKET_MESSAGES
-- ============================================================
create table if not exists public.support_ticket_messages (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  is_internal boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_support_ticket_messages_ticket_id on public.support_ticket_messages(ticket_id);

alter table public.support_ticket_messages enable row level security;

-- Ticket owner: sees the thread on their own ticket, except internal
-- (admin-only) notes.
drop policy if exists "Owner sees own ticket messages" on public.support_ticket_messages;
create policy "Owner sees own ticket messages"
  on public.support_ticket_messages for select
  using (
    is_internal = false
    and ticket_id in (select id from public.support_tickets where user_id = auth.uid())
  );

-- Ticket owner: may post to their own ticket's thread (column grants
-- below stop them from marking their own message internal).
drop policy if exists "Owner replies on own ticket" on public.support_ticket_messages;
create policy "Owner replies on own ticket"
  on public.support_ticket_messages for insert
  with check (
    sender_id = auth.uid()
    and ticket_id in (select id from public.support_tickets where user_id = auth.uid())
  );

-- Admin: full control (sees everything including internal notes).
drop policy if exists "Admin manages ticket messages" on public.support_ticket_messages;
create policy "Admin manages ticket messages"
  on public.support_ticket_messages for all
  using (public.get_user_role() = 'admin')
  with check (public.get_user_role() = 'admin');

-- Column-level lockdown: a sender may never set is_internal themselves;
-- it defaults to false. Only the service-role (admin) path can flag a
-- message as an internal note.
revoke insert on public.support_ticket_messages from authenticated, anon;
grant insert (ticket_id, sender_id, body)
  on public.support_ticket_messages to authenticated;
