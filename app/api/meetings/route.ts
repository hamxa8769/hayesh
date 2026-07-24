import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { notifyUser } from '@/lib/notifications'
import { filterInvitable } from '@/lib/meetings/invitable'
import type { Meeting } from '@/types/database'

/**
 * /api/meetings — list, create, and update scheduled video meetings.
 *
 * See supabase-migrations/011-learning-scheduling-payments.sql for the base
 * `meetings` table and supabase-migrations/016-meeting-invitations.sql for
 * the group-meeting relaxation (`participant_id` nullable, `is_group`) and
 * the new `meeting_invitations` table. All three handlers use the normal
 * cookie-based Supabase client (never the service-role client) so RLS +
 * the `enforce_meeting_write_scope` / `enforce_invitation_write_scope`
 * BEFORE UPDATE triggers are the actual source of truth; the checks here
 * exist to return clean, typed error responses instead of a raw Postgres
 * error leaking through to the client.
 */

interface MeetingErrorResponse {
  error: string
}

interface HostingInvitation {
  invitee_id: string
  status: 'invited' | 'accepted' | 'declined'
  full_name: string | null
}

interface HostingMeeting extends Meeting {
  invitations: HostingInvitation[]
}

interface InvitedMeeting extends Meeting {
  invitation_id: string
  invitation_status: 'invited' | 'accepted' | 'declined'
  organizer_name: string | null
}

interface MeetingsHubResponse {
  hosting: HostingMeeting[]
  invited: InvitedMeeting[]
}

// Raw shapes returned by the two PostgREST embeds below, before being
// reshaped into the response types above.
interface HostingMeetingRow extends Meeting {
  meeting_invitations: Array<{
    invitee_id: string
    status: 'invited' | 'accepted' | 'declined'
    invitee: { full_name: string | null } | null
  }>
}

interface InvitedMeetingRow extends Meeting {
  meeting_invitations: Array<{
    id: string
    status: 'invited' | 'accepted' | 'declined'
  }>
  organizer: { full_name: string | null } | null
}

const createMeetingSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Keep the title under 200 characters'),
  agenda: z.string().trim().max(2000, 'Keep the agenda under 2000 characters').optional(),
  scheduled_at: z.string().min(1, 'scheduled_at is required'),
  duration_minutes: z
    .number()
    .int()
    .min(15, 'Meetings must be at least 15 minutes')
    .max(180, 'Meetings can be at most 180 minutes'),
  context: z.enum(['tutoring', 'gig', 'general']),
  related_id: z.string().uuid('Invalid related_id').optional(),
  // Group invitees. Either this or the legacy participant_id must resolve to
  // at least one invitee.
  invitee_ids: z.array(z.string().uuid('Invalid invitee id')).min(1).max(20).optional(),
  // Legacy 1:1 field, still accepted so existing callers keep working.
  participant_id: z.string().uuid('Invalid participant id').optional(),
  // Opt-in waiting room (migration 018). Defaults to false so every existing
  // caller that doesn't send this field keeps today's behaviour.
  waiting_room: z.boolean().optional().default(false),
})

const patchMeetingSchema = z
  .object({
    meeting_id: z.string().uuid('Invalid meeting id'),
    status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
    scheduled_at: z.string().optional(),
    title: z.string().trim().min(1).max(200).optional(),
    agenda: z.string().trim().max(2000).optional(),
  })
  .refine(
    (values) =>
      values.status !== undefined ||
      values.scheduled_at !== undefined ||
      values.title !== undefined ||
      values.agenda !== undefined,
    { message: 'At least one field must be provided to update' }
  )

/**
 * GET /api/meetings — the caller's meetings hub: meetings they organize
 * ("hosting", with the invitee list) and meetings they were invited to
 * ("invited"). Both use the RLS-scoped client; RLS on `meetings` and
 * `meeting_invitations` (migration 016) is what actually restricts each
 * query to rows the caller may see.
 */
export async function GET(): Promise<NextResponse<MeetingsHubResponse | MeetingErrorResponse>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: hostingRows, error: hostingError } = await supabase
    .from('meetings')
    .select(
      `*, meeting_invitations(invitee_id, status, invitee:profiles!meeting_invitations_invitee_id_fkey(full_name))`
    )
    .eq('organizer_id', user.id)
    .order('scheduled_at', { ascending: false })

  if (hostingError) {
    return NextResponse.json({ error: hostingError.message }, { status: 400 })
  }

  // Filtering on the embedded meeting_invitations.invitee_id column requires
  // an inner join so only the caller's own invitation comes back per
  // meeting (a group meeting can have many invitations, but the caller only
  // ever has one). Ordering stays on the top-level `meetings.scheduled_at`.
  const { data: invitedRows, error: invitedError } = await supabase
    .from('meetings')
    .select(
      `*, meeting_invitations!inner(id, status), organizer:profiles!meetings_organizer_id_fkey(full_name)`
    )
    .eq('meeting_invitations.invitee_id', user.id)
    .order('scheduled_at', { ascending: false })

  if (invitedError) {
    return NextResponse.json({ error: invitedError.message }, { status: 400 })
  }

  // Cast through `unknown`: supabase-js types the to-one `invitee`/`organizer`
  // embeds as arrays, but PostgREST returns single objects for those
  // belongs-to relationships at runtime, which is what these row types model.
  const hosting: HostingMeeting[] = ((hostingRows as unknown as HostingMeetingRow[] | null) ?? []).map((row) => {
    const { meeting_invitations, ...meeting } = row
    return {
      ...meeting,
      invitations: meeting_invitations.map((invitation) => ({
        invitee_id: invitation.invitee_id,
        status: invitation.status,
        full_name: invitation.invitee?.full_name ?? null,
      })),
    }
  })

  const invited: InvitedMeeting[] = ((invitedRows as unknown as InvitedMeetingRow[] | null) ?? []).map((row) => {
    const { meeting_invitations, organizer, ...meeting } = row
    const invitation = meeting_invitations[0]
    return {
      ...meeting,
      invitation_id: invitation?.id ?? '',
      invitation_status: invitation?.status ?? 'invited',
      organizer_name: organizer?.full_name ?? null,
    }
  })

  return NextResponse.json({ hosting, invited })
}

/**
 * POST /api/meetings — schedules a new meeting, 1:1 or group. organizer_id
 * is always taken from the authenticated session, never from the request
 * body, so no caller can create a meeting "as" someone else. Only
 * teachers, sellers, and admins may host; invitees are restricted to the
 * host's own students/buyers (admins may invite anyone) via
 * `filterInvitable`.
 */
export async function POST(request: Request): Promise<
  NextResponse<(Meeting & { invited_count: number }) | MeetingErrorResponse>
> {
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

  const parsed = createMeetingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }

  const values = parsed.data

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle()

  const role: string = (profile as { role: string; full_name: string } | null)?.role ?? ''
  const hostName = (profile as { role: string; full_name: string } | null)?.full_name ?? 'Someone'

  if (role !== 'teacher' && role !== 'seller' && role !== 'admin') {
    return NextResponse.json(
      { error: 'Only teachers, sellers and admins can host meetings' },
      { status: 403 }
    )
  }

  const inviteeIds =
    values.invitee_ids && values.invitee_ids.length > 0
      ? values.invitee_ids
      : values.participant_id
        ? [values.participant_id]
        : []

  if (inviteeIds.length === 0) {
    return NextResponse.json({ error: 'At least one invitee is required' }, { status: 400 })
  }

  if (inviteeIds.includes(user.id)) {
    return NextResponse.json({ error: 'You cannot schedule a meeting with yourself' }, { status: 400 })
  }

  if (new Set(inviteeIds).size !== inviteeIds.length) {
    return NextResponse.json({ error: 'Duplicate invitees are not allowed' }, { status: 400 })
  }

  const scheduledAt = new Date(values.scheduled_at)
  if (Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: 'scheduled_at must be a valid date' }, { status: 400 })
  }
  if (scheduledAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: 'scheduled_at must be in the future' }, { status: 400 })
  }

  const { allowed, rejected } = await filterInvitable({
    inviterId: user.id,
    inviterRole: role,
    inviteeIds,
  })

  if (rejected.length > 0) {
    return NextResponse.json(
      { error: 'You can only invite your own students/buyers' },
      { status: 403 }
    )
  }

  // Generate the id ourselves so the room name (which must be stable and
  // known before the row is fully committed) can be derived from it and
  // stored in the same insert — no separate update round trip.
  const meetingId = randomUUID()
  const roomName = `hayesh-${meetingId}`
  const isGroup = allowed.length > 1

  const { data: meeting, error: meetingError } = await supabase
    .from('meetings')
    .insert({
      id: meetingId,
      organizer_id: user.id,
      participant_id: isGroup ? null : allowed[0],
      is_group: isGroup,
      context: values.context,
      related_id: values.related_id ?? null,
      title: values.title,
      agenda: values.agenda || null,
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: values.duration_minutes,
      room_url: roomName,
      status: 'scheduled',
      waiting_room: values.waiting_room,
    })
    .select('*')
    .maybeSingle()

  if (meetingError) {
    return NextResponse.json({ error: meetingError.message }, { status: 400 })
  }

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting was not created' }, { status: 400 })
  }

  const invitationRows = allowed.map((inviteeId) => ({
    meeting_id: meetingId,
    invitee_id: inviteeId,
    invited_by: user.id,
  }))

  const { error: invitationError } = await supabase.from('meeting_invitations').insert(invitationRows)

  if (invitationError) {
    // Don't leave an invitee-less meeting behind. Best-effort: if this
    // cleanup delete also fails, the original invitation error is still the
    // one returned to the caller.
    await supabase.from('meetings').delete().eq('id', meetingId)
    return NextResponse.json({ error: invitationError.message }, { status: 400 })
  }

  await Promise.all(
    allowed.map((inviteeId) =>
      notifyUser({
        userId: inviteeId,
        type: 'meeting_invite',
        title: 'Meeting invitation',
        message: `${hostName} invited you to "${values.title}"`,
        actionUrl: '/meetings',
      })
    )
  )

  return NextResponse.json({ ...(meeting as Meeting), invited_count: allowed.length })
}

/**
 * PATCH /api/meetings — reschedules or changes the status of a meeting.
 * Organizer or admin ONLY. A participant/invitee is refused here with a
 * clear 403 rather than being allowed to hit the database and rely on the
 * `enforce_meeting_write_scope` trigger to silently reject the write. When
 * the meeting is cancelled, every invitee is notified (best-effort).
 */
export async function PATCH(request: Request): Promise<NextResponse<Meeting | MeetingErrorResponse>> {
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

  const parsed = patchMeetingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }

  const values = parsed.data

  const { data: meeting, error: fetchError } = await supabase
    .from('meetings')
    .select('id, organizer_id, title')
    .eq('id', values.meeting_id)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 400 })
  }

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()

  const isOrganizer = (meeting as { organizer_id: string }).organizer_id === user.id
  const isAdmin = (profile as { role: string } | null)?.role === 'admin'

  if (!isOrganizer && !isAdmin) {
    return NextResponse.json(
      { error: 'Only the meeting organizer or an admin can update scheduling or status' },
      { status: 403 }
    )
  }

  const updates: Record<string, string> = {}

  if (values.status) {
    updates.status = values.status
  }
  if (values.title) {
    updates.title = values.title
  }
  if (values.agenda !== undefined) {
    updates.agenda = values.agenda
  }
  if (values.scheduled_at) {
    const scheduledAt = new Date(values.scheduled_at)
    if (Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ error: 'scheduled_at must be a valid date' }, { status: 400 })
    }
    if (scheduledAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'scheduled_at must be in the future' }, { status: 400 })
    }
    updates.scheduled_at = scheduledAt.toISOString()
  }

  const { data: updated, error: updateError } = await supabase
    .from('meetings')
    .update(updates)
    .eq('id', values.meeting_id)
    .select('*')
    .maybeSingle()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  if (!updated) {
    return NextResponse.json({ error: 'Meeting was not updated' }, { status: 400 })
  }

  if (values.status === 'cancelled') {
    const { data: invitations } = await supabase
      .from('meeting_invitations')
      .select('invitee_id')
      .eq('meeting_id', values.meeting_id)

    const meetingTitle = (meeting as { title: string }).title

    await Promise.all(
      ((invitations as Array<{ invitee_id: string }> | null) ?? []).map((invitation) =>
        notifyUser({
          userId: invitation.invitee_id,
          type: 'meeting_cancelled',
          title: 'Meeting cancelled',
          message: `"${meetingTitle}" has been cancelled`,
          actionUrl: '/meetings',
        })
      )
    )
  }

  return NextResponse.json(updated as Meeting)
}
