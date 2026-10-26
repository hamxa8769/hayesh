import type { SupabaseClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/notifications'
import type { ClassOutcome } from '@/lib/livekit/class-outcome'

export interface OutcomeMeeting {
  id: string
  title: string | null
  organizer_id: string
  participant_id: string | null
}

export interface ClassFacts {
  hostJoined: boolean
  /** Attendees that are invitees or the participant (observers and the organizer excluded). */
  studentAttendees: number
  expectedStudents: number
  students: Set<string>
}

/** Loads attendance + invitations for a meeting and derives the inputs of `decideRoomFinished`. */
export async function loadClassFacts(admin: SupabaseClient, meeting: OutcomeMeeting): Promise<ClassFacts> {
  const { data: attendance } = await admin.from('class_attendance').select('profile_id').eq('meeting_id', meeting.id)
  const attendees = new Set(((attendance ?? []) as { profile_id: string }[]).map((r) => r.profile_id))

  const { data: invites } = await admin.from('meeting_invitations').select('invitee_id').eq('meeting_id', meeting.id)
  const students = new Set(((invites ?? []) as { invitee_id: string }[]).map((r) => r.invitee_id))
  if (meeting.participant_id) students.add(meeting.participant_id)
  students.delete(meeting.organizer_id)

  return {
    hostJoined: attendees.has(meeting.organizer_id),
    studentAttendees: [...attendees].filter((id) => students.has(id)).length,
    expectedStudents: students.size,
    students,
  }
}

/** Tells the teacher and students that a class was missed. */
export async function notifyMissedClass(
  meeting: OutcomeMeeting,
  outcome: Exclude<ClassOutcome, 'completed'>,
  students: Set<string>
): Promise<void> {
  const title = meeting.title ?? 'Class'
  const message =
    outcome === 'no_show_teacher'
      ? `${title} did not take place because the teacher did not join.`
      : `${title} ended without any students joining.`
  const recipients = [meeting.organizer_id, ...students]
  await Promise.all(
    recipients.map((userId) =>
      notifyUser({ userId, type: 'meeting_cancelled', title: 'Class missed', message, actionUrl: '/meetings' })
    )
  )
}
