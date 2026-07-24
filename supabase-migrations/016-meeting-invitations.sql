-- ============================================================
-- MIGRATION 016 — Group meetings + invitation system
--
-- Until now public.meetings (migration 011) was strictly 1:1 — one
-- organizer_id and one participant_id — so there was no way for a teacher,
-- seller, or admin to *host a room and invite several registered users*,
-- nor any concept of an invitation a recipient can accept/decline. This is
-- the schema half of the "proper meetings section" feature:
--
--   * public.meetings                — participant_id relaxed to NULLABLE and
--                                       context widened to allow 'general' so a
--                                       meeting can exist with NO single primary
--                                       participant (a group room). Existing 1:1
--                                       rows are untouched and keep working.
--   * public.meeting_invitations     — NEW. one row per invited user, with a
--                                       status the invitee can accept/decline.
--                                       This is the source of truth for who may
--                                       join a group meeting.
--
-- Authorisation model (enforced in the API + token routes on top of this):
--   - organizer  : hosts, edits, invites, uninvites
--   - admin       : full control of any meeting/invitation
--   - participant_id (legacy 1:1) OR any 'invited'/'accepted' invitee : may VIEW
--     the meeting and receive a LiveKit token to join
--   - an invitee may only ever change their OWN invitation's status
--
-- Additive + idempotent. RLS is enabled AND fully policied in this same
-- migration (this codebase has shipped RLS-enabled/zero-policy tables before,
-- which silently deny-all — that must not happen again). Run once in the
-- Supabase SQL Editor.
-- ============================================================

-- ============================================================
-- 1) RELAX public.meetings FOR GROUP ROOMS
-- ============================================================

-- A group room has no single "the participant" — attendees live in
-- meeting_invitations instead — so participant_id must be allowed to be null.
-- Existing 1:1 rows keep their participant_id; nothing is rewritten.
alter table public.meetings alter column participant_id drop not null;

-- Widen the context check to allow a general-purpose meeting that is neither
-- tutoring nor tied to a gig (e.g. an admin briefing several teachers).
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'meetings_context_check'
  ) then
    alter table public.meetings drop constraint meetings_context_check;
  end if;

  alter table public.meetings
    add constraint meetings_context_check
    check (context in ('tutoring', 'gig', 'general'));
end $$;

-- Distinguishes an organizer-created group room from a legacy 1:1 meeting so
-- the UI can label it, without having to count invitations. Defaults false so
-- every existing row reads as a normal 1:1 meeting.
alter table public.meetings add column if not exists is_group boolean not null default false;


-- ============================================================
-- 2) MEETING_INVITATIONS
-- ============================================================
create table if not exists public.meeting_invitations (
  id uuid primary key default uuid_generate_v4(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'invited',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (meeting_id, invitee_id)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'meeting_invitations_status_check'
  ) then
    alter table public.meeting_invitations
      add constraint meeting_invitations_status_check
      check (status in ('invited', 'accepted', 'declined'));
  end if;
end $$;

create index if not exists idx_meeting_invitations_meeting_id on public.meeting_invitations(meeting_id);
create index if not exists idx_meeting_invitations_invitee_id on public.meeting_invitations(invitee_id);

alter table public.meeting_invitations enable row level security;

-- VIEW: the invitee sees their own invitation; the meeting's organizer sees
-- every invitation to their meeting; admins see all. The meetings sub-select
-- inside a policy expression runs as the table owner and is NOT re-filtered by
-- meetings' own RLS (the same cross-table pattern migration 011's announcements
-- policy uses), so there is no policy recursion.
drop policy if exists "Invitee and organizer see invitations" on public.meeting_invitations;
create policy "Invitee and organizer see invitations"
  on public.meeting_invitations for select
  using (
    invitee_id = auth.uid()
    or exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.organizer_id = auth.uid()
    )
    or public.get_user_role() = 'admin'
  );

-- INSERT: only the meeting's organizer (inviting to their own meeting) or an
-- admin may create an invitation, and invited_by must be the caller.
drop policy if exists "Organizer invites to own meeting" on public.meeting_invitations;
create policy "Organizer invites to own meeting"
  on public.meeting_invitations for insert
  with check (
    invited_by = auth.uid()
    and (
      exists (
        select 1 from public.meetings m
        where m.id = meeting_id and m.organizer_id = auth.uid()
      )
      or public.get_user_role() = 'admin'
    )
  );

-- UPDATE: the invitee may update their own invitation (status only — enforced
-- by the write-scope trigger below); the organizer/admin may update any
-- invitation to their meeting (e.g. re-invite).
drop policy if exists "Invitee or organizer updates invitation" on public.meeting_invitations;
create policy "Invitee or organizer updates invitation"
  on public.meeting_invitations for update
  using (
    invitee_id = auth.uid()
    or exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.organizer_id = auth.uid()
    )
    or public.get_user_role() = 'admin'
  )
  with check (
    invitee_id = auth.uid()
    or exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.organizer_id = auth.uid()
    )
    or public.get_user_role() = 'admin'
  );

-- DELETE (uninvite): organizer of the meeting or an admin only.
drop policy if exists "Organizer uninvites" on public.meeting_invitations;
create policy "Organizer uninvites"
  on public.meeting_invitations for delete
  using (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.organizer_id = auth.uid()
    )
    or public.get_user_role() = 'admin'
  );

-- Write-scope lockdown: an invitee (anyone who is NOT the organizer/admin) may
-- only ever change their own invitation's `status` — never reassign the
-- invitation to a different meeting/person. Mirrors the BEFORE UPDATE trigger
-- idiom used for meetings/assignments in migration 011, with the same
-- service-role (auth.uid() is null) / admin bypass.
create or replace function public.enforce_invitation_write_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.get_user_role() = 'admin' then
    return new;
  end if;

  -- The meeting's organizer may change any field.
  if exists (
    select 1 from public.meetings m
    where m.id = new.meeting_id and m.organizer_id = auth.uid()
  ) then
    return new;
  end if;

  -- Everyone else reaching this row is the invitee (via the update policy);
  -- they may change status and nothing else.
  if new.meeting_id is distinct from old.meeting_id
    or new.invitee_id is distinct from old.invitee_id
    or new.invited_by is distinct from old.invited_by
  then
    raise exception 'An invitee may only change the status of their own invitation';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_invitation_write_scope on public.meeting_invitations;
create trigger enforce_invitation_write_scope
  before update on public.meeting_invitations
  for each row execute function public.enforce_invitation_write_scope();

drop trigger if exists update_meeting_invitations_updated_at on public.meeting_invitations;
create trigger update_meeting_invitations_updated_at
  before update on public.meeting_invitations
  for each row execute function public.update_updated_at();


-- ============================================================
-- 3) LET INVITEES SEE THE MEETING
--
-- Extends migration 011's "Organizer and participant see meeting" SELECT
-- policy so that anyone with an invitation (invited OR accepted) can also read
-- the meeting row — otherwise a group invitee could never load the room they
-- were invited to. Organizer + legacy participant_id access is preserved.
-- ============================================================
drop policy if exists "Organizer and participant see meeting" on public.meetings;
create policy "Organizer and participant see meeting"
  on public.meetings for select
  using (
    organizer_id = auth.uid()
    or participant_id = auth.uid()
    or exists (
      select 1 from public.meeting_invitations mi
      where mi.meeting_id = meetings.id and mi.invitee_id = auth.uid()
    )
  );
