-- ============================================================
-- MIGRATION 017 — Fix infinite RLS recursion between meetings and
-- meeting_invitations (introduced by migration 016)
--
-- Migration 016 made the `meetings` SELECT policy reference
-- `meeting_invitations`, while every `meeting_invitations` policy references
-- `meetings`. For a normal (non-superuser) role these cross-table subqueries
-- inside a policy DO re-trigger the other table's RLS — contrary to the
-- comment in 016 — so evaluating either policy recurses into the other
-- forever:
--   Postgres: "infinite recursion detected in policy for relation
--   meeting_invitations".
--
-- Fix: move each cross-table check into a SECURITY DEFINER function. Such a
-- function runs as its owner (the table owner, which bypasses RLS), so its
-- internal lookup does NOT re-invoke the other table's policies — breaking the
-- cycle. This is the standard Supabase pattern (the same one public.get_user_role()
-- already uses). auth.uid() still returns the CALLING user inside a SECURITY
-- DEFINER function (it reads the request JWT, not the function owner), so the
-- checks remain correctly scoped to the current user.
--
-- Idempotent. Run once in the Supabase SQL Editor. Safe to run after 016.
-- ============================================================

-- ------------------------------------------------------------
-- 1) SECURITY DEFINER membership helpers (RLS-bypassing, user-scoped)
-- ------------------------------------------------------------

-- True if the current user is the organizer of the given meeting.
-- Reads public.meetings as the function owner, so it does NOT trigger the
-- meetings RLS policies (which is what caused the recursion).
create or replace function public.user_organizes_meeting(p_meeting_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.meetings
    where id = p_meeting_id
      and organizer_id = auth.uid()
  );
$$;

-- True if the current user has an invitation to the given meeting (any status).
-- Reads public.meeting_invitations as the function owner, so it does NOT
-- trigger the meeting_invitations RLS policies.
create or replace function public.user_invited_to_meeting(p_meeting_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.meeting_invitations
    where meeting_id = p_meeting_id
      and invitee_id = auth.uid()
  );
$$;

grant execute on function public.user_organizes_meeting(uuid) to authenticated, anon;
grant execute on function public.user_invited_to_meeting(uuid) to authenticated, anon;

-- ------------------------------------------------------------
-- 2) Recreate the meetings SELECT policy using the helper
--    (replaces the inline `exists (select ... from meeting_invitations)`
--    that recursed).
-- ------------------------------------------------------------
drop policy if exists "Organizer and participant see meeting" on public.meetings;
create policy "Organizer and participant see meeting"
  on public.meetings for select
  using (
    organizer_id = auth.uid()
    or participant_id = auth.uid()
    or public.user_invited_to_meeting(id)
  );

-- ------------------------------------------------------------
-- 3) Recreate every meeting_invitations policy using the helper
--    (replaces each inline `exists (select ... from meetings)` that recursed).
--    Behaviour is identical to migration 016 — only the recursion is removed.
-- ------------------------------------------------------------

drop policy if exists "Invitee and organizer see invitations" on public.meeting_invitations;
create policy "Invitee and organizer see invitations"
  on public.meeting_invitations for select
  using (
    invitee_id = auth.uid()
    or public.user_organizes_meeting(meeting_id)
    or public.get_user_role() = 'admin'
  );

drop policy if exists "Organizer invites to own meeting" on public.meeting_invitations;
create policy "Organizer invites to own meeting"
  on public.meeting_invitations for insert
  with check (
    invited_by = auth.uid()
    and (
      public.user_organizes_meeting(meeting_id)
      or public.get_user_role() = 'admin'
    )
  );

drop policy if exists "Invitee or organizer updates invitation" on public.meeting_invitations;
create policy "Invitee or organizer updates invitation"
  on public.meeting_invitations for update
  using (
    invitee_id = auth.uid()
    or public.user_organizes_meeting(meeting_id)
    or public.get_user_role() = 'admin'
  )
  with check (
    invitee_id = auth.uid()
    or public.user_organizes_meeting(meeting_id)
    or public.get_user_role() = 'admin'
  );

drop policy if exists "Organizer uninvites" on public.meeting_invitations;
create policy "Organizer uninvites"
  on public.meeting_invitations for delete
  using (
    public.user_organizes_meeting(meeting_id)
    or public.get_user_role() = 'admin'
  );
