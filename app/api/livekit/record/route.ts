import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { startRoomRecording, stopRoomRecording } from '@/lib/livekit/egress'

/**
 * POST /api/livekit/record — host/admin-only: start or stop recording a room.
 *
 * Authorisation mirrors app/api/livekit/moderate/route.ts exactly: the room
 * name identifies a meeting (`hayesh-<uuid>`), and the caller must be that
 * meeting's organizer or a platform admin. The meeting is looked up via the
 * service-role admin client for the same reason as the moderate/token routes
 * (so "not authorised" and "not found" stay distinguishable).
 *
 * Recording is wired but INERT until the operator configures LiveKit Egress +
 * an S3 bucket: `startRoomRecording` throws "Recording is not configured",
 * which this route reports as a clean 501 rather than a broken button.
 */

const recordRequestSchema = z
  .object({
    room: z.string().min(1, 'room is required'),
    action: z.enum(['start', 'stop']),
    egress_id: z.string().min(1).optional(),
  })
  .refine((value) => value.action !== 'stop' || Boolean(value.egress_id), {
    message: 'egress_id is required to stop a recording',
    path: ['egress_id'],
  })

interface RecordStartResponse {
  ok: true
  egressId: string
}
interface RecordStopResponse {
  ok: true
}
interface RecordErrorResponse {
  error: string
}

const ROOM_NAME_PATTERN = /^hayesh-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

export async function POST(
  request: Request
): Promise<NextResponse<RecordStartResponse | RecordStopResponse | RecordErrorResponse>> {
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

  const parsed = recordRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }

  const { room, action, egress_id: egressId } = parsed.data

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
    return NextResponse.json({ error: 'You are not authorised to record this meeting' }, { status: 403 })
  }

  if (action === 'start') {
    try {
      const { egressId: newEgressId } = await startRoomRecording(room)
      return NextResponse.json({ ok: true, egressId: newEgressId })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to start recording'
      if (message === 'Recording is not configured') {
        return NextResponse.json(
          { error: 'Recording is not configured. Ask the operator to set up LiveKit Egress + storage.' },
          { status: 501 }
        )
      }
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  // action === 'stop' (egress_id guaranteed by the schema refine)
  try {
    await stopRoomRecording(egressId as string)
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to stop recording'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
