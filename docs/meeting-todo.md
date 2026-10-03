# Meeting feature — handoff / TODO

Handoff notes so a fresh session (cloud or local) can continue the LiveKit
meeting work without re-deriving context. Last updated after commit `397e2ab`.

## Stack / ground rules (do not deviate)
- Video runs on **LiveKit** (`@livekit/components-react` ^2.9, `livekit-client` ^2.20) — NOT Daily/Agora. Do not switch providers.
- Tokens are hand-minted (no `livekit-server-sdk`): see `lib/livekit/tokens.ts`, `lib/livekit/room-service.ts`, `lib/livekit/egress.ts` (same HS256 idiom, `if (typeof window !== 'undefined') throw` guard).
- Design system = **Obsidian Aurora** (`.claude/rules/design-system.md`). Real token classes only: `bg-background bg-surface bg-surface-elevated border-border border-line-strong text-text-primary/muted/disabled text-accent-primary/secondary accent-success/warning/danger .aurora-bg .aurora-text glow-violet`. NEVER `bg-surface-2`, `text-foreground`, bare `border-line` (they render nothing).
- TS strict, no `any`, named exports, `"use client"` line 1 for client components.
- **Build is the gate:** `npm run build` (Next lint is fatal — tsc passing is not enough). On this Windows machine use **PowerShell** for git/npm (the Bash tool's PATH is broken: no git/npm/grep). Commit via `git commit -F <file>` (heredocs/inline `-m` with special chars break in PowerShell).
- Orchestrator policy (`.claude/rules/orchestrator.md`): Fable plans/reviews, Sonnet agents write code. BUT agents have repeatedly died mid-write on session/network limits — several of these files were ultimately hand-written + salvaged. If agents keep failing, write by hand.

## Operator setup required for the feature to actually run
1. Restart dev server after any `.env.local` change (`npm run dev`) — Next reads env only at startup.
2. Run these migrations in the Supabase SQL Editor (by hand — user runs migrations):
   - `supabase-migrations/016-meeting-invitations.sql` (group meetings + invitations)
   - `supabase-migrations/017-fix-meeting-invitations-recursion.sql` (RLS recursion fix)
   - `supabase-migrations/018-meeting-waiting-room.sql` (`waiting_room` column)
   - `supabase-migrations/024-meeting-attachments.sql` (chat attachments bucket + RLS)
3. LiveKit creds are set in `.env.local` (real values): `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. `FIELD_ENCRYPTION_KEY` also set (payments).
4. Recording is INERT until Egress + storage configured: set `LIVEKIT_EGRESS_S3_BUCKET`, `LIVEKIT_EGRESS_S3_ACCESS_KEY`, `LIVEKIT_EGRESS_S3_SECRET`, `LIVEKIT_EGRESS_S3_REGION` (LiveKit Cloud has Egress built in; point it at an S3 bucket).
5. `.env.local` is gitignored — a cloud session won't have it, so cloud can build/commit but CANNOT live-test the call.

## Already shipped (committed + pushed)
- Group meetings + invitations backend (`196acb1`), meetings hub UI `/meetings` (`0ac9717`), host moderation mute/remove (`c324029`), opt-in waiting room + admit (`3444fc3`), start-now instant meetings + Meetings in every dashboard sidebar (`7098071`), recording wired-but-inert (`f9d593b`), full-screen call + share/invite link + mobile screen-share gating (`d1bae38`), professional single-focus stage (`ea5e824`), and the latest fix batch — no overlapping labels (uses raw `<VideoTrack>`, not `<ParticipantTile>`, because the lk styles package isn't installed so its default overlays render unstyled and overlap), fullscreen button, reliable host-late-join admit popup, auto-dismiss toasts, popover outside-click close, robust copy (`397e2ab`).
- Key files: `components/video/{VideoRoom,MeetingStage,ControlDock,ChatSheet,ParticipantsSheet,BottomSheet,ReactionsOverlay,Avatar,room-messaging}.tsx`, `app/meet/[id]/page.tsx`, `app/meetings/page.tsx`, `components/meetings/*`, `app/api/livekit/{token,moderate,admit,record}/route.ts`, `app/api/meetings/{route,invitations,invitees}`.
- In-room realtime (chat, reactions ✋, raise-hand, recording REC flag) all ride ONE LiveKit data-channel topic `"hayesh"` — see `components/video/room-messaging.ts` (`useRoomMessaging`). Add new in-room signals there as new envelope `kind`s.

## DONE — second batch (all five former PENDING items)
1. **Chat bubbles** — `components/video/ChatBubbles.tsx`: last 3 messages from the past ~8s, mid-left over the stage (clear of the name pill + filmstrip), hidden while the chat sheet is open, fade-only under `prefers-reduced-motion`.
2. **Emoji picker** — ChatSheet has a smile button opening a 40-emoji grid (no dependency); inserts at the input caret.
3. **Request-to-present** — new data-channel kinds `request-present` / `present-granted` / `present-denied` in `room-messaging.ts`. Attendees see a "Request to present" button instead of screen-share; host/admin gets an Allow/Deny popup; grants are targeted (`destinationIdentities`) and only honoured when sent by a host/admin (checked via sender metadata). NOTE: this is UI-level gating — attendee tokens still have `canPublish`, so it is not a hard server-side restriction.
4. **In-call invite** — `POST /api/meetings/[id]/invite` `{ invitee_ids: uuid[1..50] }` (organizer or admin only; reuses `filterInvitable` + `notifyUser` "meeting_invite"; skips already-invited; returns `{ invited, already_invited }`). `InviteePicker` is embedded in the ControlDock Share popover for host/admin.
5. **Chat attachments** — private bucket `meeting-attachments` (10 MB; images/pdf/docx/pptx/xlsx/txt) + storage RLS via `public.can_access_meeting()`; browser uploads to `<meeting_id>/<uid>/<ts>-<name>`; chat envelope carries `attachment { name, path, size, mime }`; recipients click a file chip -> `POST /api/meetings/[id]/attachments` `{ path }` returns a 120s signed URL (minted with the caller's own session so storage RLS authorises it). Client-side size/type validation in `components/video/chat-attachments.ts`.

**New migration to run by hand:** `supabase-migrations/024-meeting-attachments.sql` (idempotent) — without it, attachment uploads fail (bucket missing).

Not live-tested (no LiveKit server in the cloud session); verify in a real call: bubbles placement, request/allow flow, mid-call invite notification link `/meet/<id>`, upload + download chip.

## Other open items (unrelated to meetings, flagged earlier)
- `/admin/disputes` is still a stub — decide escrow/refund flow vs support-ticket category.
- Gig "Place Order" button on `/marketplace/[id]` is a placeholder — real checkout (Stripe/Simpaisa) not built.
