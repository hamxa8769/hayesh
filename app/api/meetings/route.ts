import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

/**
 * /api/meetings — create and update scheduled video meetings.
 *
 * See supabase-migrations/011-learning-scheduling-payments.sql for the
 * `meetings` table. Both routes use the normal cookie-based Supabase client
 * (never the service-role client) so RLS + the `enforce_meeting_write_scope`
 * BEFORE UPDATE trigger are the actual source of truth; the checks here exist
 * to return clean, typed error responses instead of a raw Postgres error
 * leaking through to the client.
 */

export interface MeetingRow {
  id: string
  organizer_id: string
  participant_id: string
  context: 'tutoring' | 'gig'
  related_id: string | null
  title: string
  agenda: string | null
  scheduled_at: string
  duration_minutes: number | null
  room_url: string | null
  status: 'scheduled' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
}

interface MeetingErrorResponse {
  error: string
}

const createMeetingSchema = z.object({
  participant_id: z.string().uuid('Invalid participant id'),
  title: z.string().trim().min(1, 'Title is required').max(200, 'Keep the title under 200 characters'),
  agenda: z.string().trim().max(2000, 'Keep the agenda under 2000 characters').optional(),
  scheduled_at: z.string().min(1, 'scheduled_at is required'),
  duration_minutes: z
    .number()
    .int()
    .min(15, 'Meetings must be at least 15 minutes')
    .max(180, 'Meetings can be at most 180 minutes'),
  context: z.enum(['tutoring', 'gig']),
  related_id: z.string().uuid('Invalid related_id').optional(),
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
 * POST /api/meetings — schedules a new meeting. organizer_id is always taken
 * from the authenticated session, never from the request body, so no caller
 * can create a meeting "as" someone else.
 */
export async function POST(request: Request): Promise<NextResponse<MeetingRow | MeetingErrorResponse>> {
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

  if (values.participant_id === user.id) {
    return NextResponse.json({ error: 'You cannot schedule a meeting with yourself' }, { status: 400 })
  }

  const scheduledAt = new Date(values.scheduled_at)
  if (Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: 'scheduled_at must be a valid date' }, { status: 400 })
  }
  if (scheduledAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: 'scheduled_at must be in the future' }, { status: 400 })
  }

  // Generate the id ourselves so the room name (which must be stable and
  // known before the row is fully committed) can be derived from it and
  // stored in the same insert — no separate update round trip.
  const meetingId = randomUUID()
  const roomName = `hayesh-${meetingId}`

  const { data, error } = await supabase
    .from('meetings')
    .insert({
      id: meetingId,
      organizer_id: user.id,
      participant_id: values.participant_id,
      context: values.context,
      related_id: values.related_id ?? null,
      title: values.title,
      agenda: values.agenda || null,
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: values.duration_minutes,
      room_url: roomName,
      status: 'scheduled',
    })
    .select('*')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Meeting was not created' }, { status: 400 })
  }

  return NextResponse.json(data as MeetingRow)
}

/**
 * PATCH /api/meetings — reschedules or changes the status of a meeting.
 * Organizer or admin ONLY. A participant is refused here with a clear 403
 * rather than being allowed to hit the database and rely on the
 * `enforce_meeting_write_scope` trigger to silently reject the write.
 */
export async function PATCH(request: Request): Promise<NextResponse<MeetingRow | MeetingErrorResponse>> {
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
    .select('id, organizer_id')
    .eq('id', values.meeting_id)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 400 })
  }

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()

  const isOrganizer = meeting.organizer_id === user.id
  const isAdmin = profile?.role === 'admin'

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

  return NextResponse.json(updated as MeetingRow)
}
