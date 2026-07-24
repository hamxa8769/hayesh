import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { MeetingInvitation } from '@/types/database'

/**
 * /api/meetings/invitations — the caller's invitation inbox: every meeting
 * they've been invited to, and letting them accept/decline their own
 * invitation. Always the RLS-scoped client — RLS + the
 * `enforce_invitation_write_scope` BEFORE UPDATE trigger (migration 016)
 * are the actual source of truth; the invitee_id filter here just returns a
 * clean typed response instead of a raw Postgres error.
 */

interface InvitationErrorResponse {
  error: string
}

interface InvitationInboxItem {
  invitation_id: string
  invitation_status: 'invited' | 'accepted' | 'declined'
  meeting_id: string
  title: string
  scheduled_at: string
  duration_minutes: number | null
  meeting_status: 'scheduled' | 'completed' | 'cancelled'
  organizer_name: string | null
}

interface InvitationInboxResponse {
  invitations: InvitationInboxItem[]
}

// Raw shape returned by the PostgREST embed below, before being reshaped
// into InvitationInboxItem.
interface InvitationRow {
  id: string
  status: 'invited' | 'accepted' | 'declined'
  meeting: {
    id: string
    title: string
    scheduled_at: string
    duration_minutes: number | null
    status: 'scheduled' | 'completed' | 'cancelled'
    organizer: { full_name: string | null } | null
  } | null
}

const patchInvitationSchema = z.object({
  invitation_id: z.string().uuid('Invalid invitation id'),
  status: z.enum(['accepted', 'declined']),
})

/**
 * GET /api/meetings/invitations — every invitation addressed to the caller,
 * newest meeting first.
 */
export async function GET(): Promise<NextResponse<InvitationInboxResponse | InvitationErrorResponse>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('meeting_invitations')
    .select(
      `id, status,
       meeting:meetings!meeting_invitations_meeting_id_fkey(
         id, title, scheduled_at, duration_minutes, status,
         organizer:profiles!meetings_organizer_id_fkey(full_name)
       )`
    )
    .eq('invitee_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // supabase-js types to-one embeds (meeting, organizer) as arrays, but
  // PostgREST returns a single object for a belongs-to relationship at
  // runtime — hence the cast through `unknown` to the object-shaped
  // InvitationRow rather than a direct (and rejected) cast.
  const rows = (data as unknown as InvitationRow[] | null) ?? []

  const invitations: InvitationInboxItem[] = rows
    .filter((row): row is InvitationRow & { meeting: NonNullable<InvitationRow['meeting']> } => row.meeting !== null)
    .map((row) => ({
      invitation_id: row.id,
      invitation_status: row.status,
      meeting_id: row.meeting.id,
      title: row.meeting.title,
      scheduled_at: row.meeting.scheduled_at,
      duration_minutes: row.meeting.duration_minutes,
      meeting_status: row.meeting.status,
      organizer_name: row.meeting.organizer?.full_name ?? null,
    }))
    // Sorted in JS (rather than at the query level) because the sort key
    // lives on the embedded `meetings` resource, not the top-level
    // `meeting_invitations` row being queried.
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())

  return NextResponse.json({ invitations })
}

/**
 * PATCH /api/meetings/invitations — the invitee accepts or declines their
 * own invitation. The `.eq('invitee_id', user.id)` filter is belt-and-
 * suspenders on top of RLS + the write-scope trigger, which already forbid
 * anyone but the invitee (or the organizer/admin) from touching this row.
 */
export async function PATCH(
  request: Request
): Promise<NextResponse<MeetingInvitation | InvitationErrorResponse>> {
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

  const parsed = patchInvitationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('meeting_invitations')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.invitation_id)
    .eq('invitee_id', user.id)
    .select('*')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (!updated) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
  }

  return NextResponse.json(updated as MeetingInvitation)
}
