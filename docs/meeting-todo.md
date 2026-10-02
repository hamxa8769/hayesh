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
3. LiveKit creds are set in `.env.local` (real values): `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. `FIELD_ENCRYPTION_KEY` also set (payments).
4. Recording is INERT until Egress + storage configured: set `LIVEKIT_EGRESS_S3_BUCKET`, `LIVEKIT_EGRESS_S3_ACCESS_KEY`, `LIVEKIT_EGRESS_S3_SECRET`, `LIVEKIT_EGRESS_S3_REGION` (LiveKit Cloud has Egress built in; point it at an S3 bucket).
5. `.env.local` is gitignored — a cloud session won't have it, so cloud can build/commit but CANNOT live-test the call.

## Already shipped (committed + pushed)
- Group meetings + invitations backend (`196acb1`), meetings hub UI `/meetings` (`0ac9717`), host moderation mute/remove (`c324029`), opt-in waiting room + admit (`3444fc3`), start-now instant meetings + Meetings in every dashboard sidebar (`7098071`), recording wired-but-inert (`f9d593b`), full-screen call + share/invite link + mobile screen-share gating (`d1bae38`), professional single-focus stage (`ea5e824`), and the latest fix batch — no overlapping labels (uses raw `<VideoTrack>`, not `<ParticipantTile>`, because the lk styles package isn't installed so its default overlays render unstyled and overlap), fullscreen button, reliable host-late-join admit popup, auto-dismiss toasts, popover outside-click close, robust copy (`397e2ab`).
- Key files: `components/video/{VideoRoom,MeetingStage,ControlDock,ChatSheet,ParticipantsSheet,BottomSheet,ReactionsOverlay,Avatar,room-messaging}.tsx`, `app/meet/[id]/page.tsx`, `app/meetings/page.tsx`, `components/meetings/*`, `app/api/livekit/{token,moderate,admit,record}/route.ts`, `app/api/meetings/{route,invitations,invitees}`.
- In-room realtime (chat, reactions ✋, raise-hand, recording REC flag) all ride ONE LiveKit data-channel topic `"hayesh"` — see `components/video/room-messaging.ts` (`useRoomMessaging`). Add new in-room signals there as new envelope `kind`s.

## PENDING — build in this order
1. **Chat bubbles in the room** — show the last few chat messages as small transient bubbles over the stage so the host sees questions without opening the chat sheet. Data already in `useRoomMessaging().messages`. Watch out: don't overlap the primary tile's bottom-left name pill or the bottom filmstrip band (place e.g. mid-left, fade after ~8s).
2. **Emoji picker in chat** (`ChatSheet.tsx`) — a small emoji button that inserts into the input. No backend needed.
3. **Attendees request-to-present → host allow/deny** — attendees don't get the screen-share button by default; they get a "Request to present" button that broadcasts a `request-present` envelope on the data channel; host sees a popup to Allow/Deny; on allow, broadcast `present-granted` to that identity and the requester's ControlDock reveals the screen-share toggle (they already have canPublish). Pure data-channel + UI, no new endpoint. Also: when a screen is shared, the stage already takes over (single-focus) — confirm it closes other large video (it does).
4. **In-call "Invite" of registered users by host** — add a small endpoint to add invitees to an EXISTING meeting (insert `meeting_invitations` rows for the organizer's allowed set via `lib/meetings/invitable.ts` `filterInvitable`, then `notifyUser`). Reuse `components/meetings/InviteePicker.tsx` inside the in-call Share popover (ControlDock) for host/admin. Note: host already invites registered users at meeting CREATION (the Host-a-Meeting modal) and everyone can share the link — this is specifically mid-call registered-user invite.
5. **Chat attachment upload** — needs a Supabase Storage bucket (e.g. `meeting-attachments`) + an upload API route + RLS so only room participants can read; share the file URL as a chat envelope. Biggest item; needs the bucket created first.

## Other open items (unrelated to meetings, flagged earlier)
- `/admin/disputes` is still a stub — decide escrow/refund flow vs support-ticket category.
- Gig "Place Order" button on `/marketplace/[id]` is a placeholder — real checkout (Stripe/Simpaisa) not built.
