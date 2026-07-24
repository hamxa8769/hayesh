import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateParticipantPermission } from '@/lib/livekit/room-service'

/**
 * POST /api/livekit/admit — host/admin-only: admits a single waiting-room
 * participant into the room by granting them publish + subscribe
 * permissions via LiveKit UpdateParticipant.
 *
 * Authorisation mirrors app/api/livekit/moderate/route.ts exactly: the room
 * name identifies a meeting (`hayesh-<uuid>`), and the caller must be that
 * meeting's organizer or a platform admin. The meeting row is looked up via
 * the service-role admin client (not the cookie-scoped RLS client) for the
 * same reason as the moderate/token routes — an RLS-scoped lookup collapses
 * "not authorised" and "not found" into the same empty result, which would
 * prevent a clean 403 vs 404 distinction here.
 */

const admitRequestSchema = z.object({
  room: z.string().min(1, 'room is required'),
  target_identity: z.string().min(1, 'target_identity is required'),
})

interface AdmitSuccessResponse {
  ok: true
}

interface AdmitErrorResponse {
  error: string
}

const ROOM_NAME_PATTERN = /^hayesh-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

export async function POST(request: Request): Promise<NextResponse<AdmitSuccessResponse | AdmitErrorResponse>> {
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

  const parsed = admitRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }

  const { room, target_identity: targetIdentity } = parsed.data

  // The room name is only ever meaningful as `hayesh-<meeting uuid>` (see
  // POST /api/meetings and the token route) — reject anything else before
  // ever touching the database or LiveKit.
  const roomNameMatch = room.match(ROOM_NAME_PATTERN)
  if (!roomNameMatch) {
    return NextResponse.json({ error: 'Invalid room name' }, { status: 400 })
  }
  const meetingId = roomNameMatch[1]

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
    return NextResponse.json({ error: 'You are not authorised to admit participants in this meeting' }, { status: 403 })
  }

  try {
    await updateParticipantPermission(room, targetIdentity, {
      canSubscribe: true,
      canPublish: true,
      canPublishData: true,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to admit participant'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
