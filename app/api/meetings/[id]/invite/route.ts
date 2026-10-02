import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/require-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { filterInvitable } from '@/lib/meetings/invitable'
import { notifyUser } from '@/lib/notifications'

/**
 * POST /api/meetings/[id]/invite — adds registered users to an EXISTING
 * meeting mid-call. Only the meeting's organizer (host) or an admin may do
 * this. Invitees go through the same `filterInvitable` rules as meeting
 * creation (a teacher/seller may only invite their own students/buyers;
 * admins may invite anyone). Users who already hold an invitation are
 * skipped. Rows are written with the caller's RLS-scoped client so the
 * "Organizer invites to own meeting" policy is still the source of truth.
 */

const paramsSchema = z.object({ id: z.string().uuid() })

const bodySchema = z.object({
  invitee_ids: z.array(z.string().uuid()).min(1, 'Select at least one person').max(50, 'Invite at most 50 people at once'),
})

interface InviteResponse {
  invited: number
  already_invited: number
}

interface ErrorResponse {
  error: string
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse<InviteResponse | ErrorResponse>> {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { userId, role, fullName, supabase } = auth.user

  const parsedParams = paramsSchema.safeParse(await context.params)
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid meeting id' }, { status: 400 })
  }
  const meetingId = parsedParams.data.id

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsedBody = bodySchema.safeParse(body)
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }

  // The meetings SELECT policy does not cover admins, so the lookup uses the
  // service-role client; authorisation is decided explicitly just below.
  const { data: meeting, error: meetingError } = await createAdminClient()
    .from('meetings')
    .select('id, organizer_id, participant_id, title, status')
    .eq('id', meetingId)
    .maybeSingle()

  if (meetingError) {
    return NextResponse.json({ error: 'Could not load the meeting' }, { status: 400 })
  }
  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
  }

  const row = meeting as {
    organizer_id: string
    participant_id: string | null
    title: string
    status: 'scheduled' | 'completed' | 'cancelled'
  }

  if (row.organizer_id !== userId && role !== 'admin') {
    return NextResponse.json({ error: 'Only the host or an admin can invite people' }, { status: 403 })
  }
  if (row.status !== 'scheduled') {
    return NextResponse.json({ error: 'This meeting is no longer active' }, { status: 409 })
  }

  const requested = Array.from(new Set(parsedBody.data.invitee_ids)).filter(
    (id) => id !== row.organizer_id && id !== userId
  )
  if (requested.length === 0) {
    return NextResponse.json({ error: 'No valid people to invite' }, { status: 400 })
  }

  const { allowed, rejected } = await filterInvitable({
    inviterId: userId,
    inviterRole: role,
    inviteeIds: requested,
  })
  if (rejected.length > 0) {
    return NextResponse.json({ error: 'You can only invite your own students/buyers' }, { status: 403 })
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('meeting_invitations')
    .select('invitee_id')
    .eq('meeting_id', meetingId)
    .in('invitee_id', allowed)
  if (existingError) {
    return NextResponse.json({ error: 'Could not check existing invitations' }, { status: 400 })
  }

  const existing = new Set(((existingRows as Array<{ invitee_id: string }> | null) ?? []).map((r) => r.invitee_id))
  const toInvite = allowed.filter((id) => !existing.has(id) && id !== row.participant_id)
  const alreadyInvited = allowed.length - toInvite.length

  if (toInvite.length > 0) {
    const { error: insertError } = await supabase.from('meeting_invitations').insert(
      toInvite.map((inviteeId) => ({
        meeting_id: meetingId,
        invitee_id: inviteeId,
        invited_by: userId,
      }))
    )
    if (insertError) {
      return NextResponse.json({ error: 'Could not send the invitations' }, { status: 400 })
    }

    await Promise.all(
      toInvite.map((inviteeId) =>
        notifyUser({
          userId: inviteeId,
          type: 'meeting_invite',
          title: 'Meeting invitation',
          message: `${fullName} invited you to join "${row.title}" now`,
          actionUrl: `/meet/${meetingId}`,
        })
      )
    )
  }

  return NextResponse.json({ invited: toInvite.length, already_invited: alreadyInvited })
}
