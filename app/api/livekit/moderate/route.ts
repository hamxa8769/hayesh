import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { muteParticipantAudio, removeParticipant, listParticipants } from '@/lib/livekit/room-service'

/**
 * POST /api/livekit/moderate — host/admin-only room moderation: mute one
 * participant, mute everyone, or remove a participant.
 *
 * Authorisation is the entire point of this route. The room name identifies
 * a meeting (`hayesh-<uuid>`, see app/api/livekit/token/route.ts), and the
 * caller must be that meeting's organizer or a platform admin — never
 * trusting anything the client claims about its own privileges. The meeting
 * row is looked up via the service-role admin client (not the cookie-scoped
 * RLS client) for the same reason as the token route: an RLS-scoped lookup
 * collapses "not authorised" and "not found" into the same empty result,
 * which would prevent a clean 403 vs 404 distinction here.
 */

const moderateRequestSchema = z
  .object({
    room: z.string().min(1, 'room is required'),
    action: z.enum(['mute_participant', 'remove_participant', 'mute_all']),
    target_identity: z.string().min(1).optional(),
  })
  .refine(
    (value) => value.action === 'mute_all' || Boolean(value.target_identity),
    { message: 'target_identity is required for this action', path: ['target_identity'] }
  )

interface ModerateSuccessResponse {
  ok: true
}

interface ModerateErrorResponse {
  error: string
}

const ROOM_NAME_PATTERN = /^hayesh-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

export async function POST(
  request: Request
): Promise<NextResponse<ModerateSuccessResponse | ModerateErrorResponse>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = moderateRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }

  const { room, action, target_identity: targetIdentity } = parsed.data

  // The room name is only ever meaningful as `hayesh-<meeting uuid>` (see
  // POST /api/meetings and the token route) — reject anything else before
  // ever touching the database or LiveKit.
  const roomNameMatch = room.match(ROOM_NAME_PATTERN)
  if (!roomNameMatch) {
    return NextResponse.json({ error: 'Invalid room name' }, { status: 400 })
  }
  const meetingId = roomNameMatch[1]

  if (targetIdentity && targetIdentity === user.id) {
    return NextResponse.json({ error: 'You cannot moderate yourself' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  const { data: meeting, error: meetingError } = await adminClient
    .from('meetings')
    .select('id, organizer_id')
    .eq('id', meetingId)
    .maybeSingle()

  if (meetingError) {
    return NextResponse.json({ error: meetingError.message }, { status: 400 })
  }

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()

  const isOrganizer = meeting.organizer_id === user.id
  const isAdmin = profile?.role === 'admin'

  if (!isOrganizer && !isAdmin) {
    return NextResponse.json({ error: 'You are not authorised to moderate this meeting' }, { status: 403 })
  }

  try {
    if (action === 'mute_participant' && targetIdentity) {
      await muteParticipantAudio(room, targetIdentity)
    } else if (action === 'remove_participant' && targetIdentity) {
      await removeParticipant(room, targetIdentity)
    } else if (action === 'mute_all') {
      const participants = await listParticipants(room)
      for (const participant of participants) {
        if (participant.identity === user.id || participant.identity === 'hayesh-moderator') continue
        await muteParticipantAudio(room, participant.identity)
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to moderate room'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
