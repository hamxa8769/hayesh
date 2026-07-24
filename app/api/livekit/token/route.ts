import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLiveKitToken } from '@/lib/livekit/tokens'

/**
 * POST /api/livekit/token — mints a short-lived LiveKit access token for a
 * specific meeting.
 *
 * Authorisation is the entire point of this route: only the meeting's
 * organizer, its (legacy 1:1) participant, an admin, or — for group
 * meetings (migration 016) — a user with a live 'invited'/'accepted'
 * meeting_invitations row may receive a token. Both the room name and the
 * caller's identity are derived server-side from the authenticated session
 * and the meetings row — never from anything the client sends — so no
 * caller can mint a token for an arbitrary room or impersonate another
 * identity.
 *
 * The meeting row (and the invitation check) is looked up via the
 * service-role admin client, NOT the cookie-scoped RLS client: the
 * "Organizer and participant see meeting" RLS policy already hides other
 * people's rows entirely, which means an RLS-scoped lookup for a
 * real-but-not-mine meeting and a lookup for a genuinely nonexistent meeting
 * are indistinguishable (both come back empty) — collapsing "not
 * authorised" into "not found". The explicit
 * organizer/participant/admin/invitee check below is what actually enforces
 * authorisation instead, so it can return a real 403 for the former and a
 * real 404 for the latter.
 */

const tokenRequestSchema = z.object({
  meeting_id: z.string().uuid('Invalid meeting id'),
})

interface TokenSuccessResponse {
  token: string
  url: string
  roomName: string
}

interface TokenErrorResponse {
  error: string
}

export async function POST(request: Request): Promise<NextResponse<TokenSuccessResponse | TokenErrorResponse>> {
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

  const parsed = tokenRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  const { data: meeting, error: meetingError } = await adminClient
    .from('meetings')
    .select('id, organizer_id, participant_id, room_url, status')
    .eq('id', parsed.data.meeting_id)
    .maybeSingle()

  if (meetingError) {
    return NextResponse.json({ error: meetingError.message }, { status: 400 })
  }

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
  }

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).maybeSingle()

  const isOrganizer = meeting.organizer_id === user.id
  const isParticipant = meeting.participant_id === user.id
  const isAdmin = profile?.role === 'admin'

  // Group meetings (migration 016) have no single participant_id — attendees
  // live in meeting_invitations instead. Only checked when none of the
  // cheaper checks above already authorised the caller, since it's an extra
  // round trip.
  let isInvitee = false
  if (!isOrganizer && !isParticipant && !isAdmin) {
    const { data: invitation } = await adminClient
      .from('meeting_invitations')
      .select('id')
      .eq('meeting_id', meeting.id)
      .eq('invitee_id', user.id)
      .in('status', ['invited', 'accepted'])
      .maybeSingle()

    isInvitee = invitation !== null
  }

  if (!isOrganizer && !isParticipant && !isAdmin && !isInvitee) {
    return NextResponse.json({ error: 'You are not authorised to join this meeting' }, { status: 403 })
  }

  if (meeting.status === 'cancelled') {
    return NextResponse.json({ error: 'This meeting has been cancelled' }, { status: 400 })
  }

  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL
  if (!livekitUrl) {
    return NextResponse.json(
      { error: 'Video calling is not configured (missing NEXT_PUBLIC_LIVEKIT_URL)' },
      { status: 500 }
    )
  }

  // room_url is populated at creation time (see POST /api/meetings) as
  // `hayesh-${meeting.id}`. Fall back to regenerating it from the id for any
  // legacy/edge-case row where it is somehow missing, so a null room_url
  // never turns into a token for an undefined room.
  const roomName = meeting.room_url || `hayesh-${meeting.id}`

  let token: string
  try {
    token = await createLiveKitToken({
      roomName,
      identity: user.id,
      name: profile?.full_name || undefined,
      canPublish: true,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create video token'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ token, url: livekitUrl, roomName })
}
