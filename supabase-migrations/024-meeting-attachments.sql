-- ============================================================
-- MIGRATION 024 — Meeting chat attachments (private storage bucket)
--
-- WHY: in-call chat could only carry text. Participants want to share
-- a file (image, PDF, Office doc, text) with the room. Files live in a
-- PRIVATE bucket "meeting-attachments"; only people who can actually
-- join the meeting can upload to / read from its folder.
--
-- Object path convention (enforced by the policies below):
--     <meeting_id>/<uploader auth.uid()>/<timestamp>-<safe file name>
--   segment 1 = meeting id the uploader can access
--   segment 2 = the uploader's own user id
--
-- "Can access a meeting" mirrors the token route + meetings RLS from
-- migrations 016/017: the organizer, the legacy 1:1 participant, an
-- invitee whose invitation is 'invited' or 'accepted', or an admin.
--
-- Reads happen via short-lived signed URLs minted by
-- POST /api/meetings/[id]/attachments (the browser session's own select
-- policy is what authorises it). Run once in the Supabase SQL Editor.
-- Idempotent / re-runnable.
-- ============================================================

-- ── Access helper ───────────────────────────────────────────
-- SECURITY DEFINER so it can read meetings/meeting_invitations without
-- tripping their own RLS (same reason as user_organizes_meeting in 017).
create or replace function public.can_access_meeting(p_meeting_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    public.get_user_role() = 'admin'
    or exists (
      select 1 from public.meetings m
      where m.id = p_meeting_id
        and (m.organizer_id = auth.uid() or m.participant_id = auth.uid())
    )
    or exists (
      select 1 from public.meeting_invitations mi
      where mi.meeting_id = p_meeting_id
        and mi.invitee_id = auth.uid()
        and mi.status in ('invited', 'accepted')
    );
$$;

grant execute on function public.can_access_meeting(uuid) to authenticated;

-- ── Bucket: private, 10 MB, whitelisted mime types ──────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meeting-attachments',
  'meeting-attachments',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── Storage RLS ─────────────────────────────────────────────
-- Upload: first segment must be a meeting the caller can access (guarded
-- so a non-uuid folder name can never raise a cast error) and the second
-- segment must be the caller's own id.
drop policy if exists "meeting-attachments participant upload" on storage.objects;
create policy "meeting-attachments participant upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'meeting-attachments'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.can_access_meeting(((storage.foldername(name))[1])::uuid)
  );

-- Read: anyone who can access that meeting, or an admin.
drop policy if exists "meeting-attachments participant read" on storage.objects;
create policy "meeting-attachments participant read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'meeting-attachments'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.can_access_meeting(((storage.foldername(name))[1])::uuid)
  );
