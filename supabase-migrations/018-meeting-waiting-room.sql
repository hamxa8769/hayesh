-- ============================================================
-- MIGRATION 018 — Opt-in waiting room for meetings
--
-- Adds a per-meeting `waiting_room` flag. When true, non-host attendees are
-- issued a LiveKit token with canPublish/canSubscribe both false (see
-- app/api/livekit/token/route.ts) — they connect to the room so the host can
-- see them, but cannot see/hear/be seen until the host admits them via
-- POST /api/livekit/admit (lib/livekit/room-service.ts updateParticipantPermission).
--
-- Defaults to false so every existing meeting keeps today's behaviour
-- (everyone admitted immediately) with zero migration of existing rows.
--
-- Idempotent. Safe to run multiple times and safe to run after 016/017.
-- ============================================================

alter table public.meetings
  add column if not exists waiting_room boolean not null default false;
