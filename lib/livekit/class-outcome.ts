export type ClassOutcome = 'completed' | 'no_show_teacher' | 'no_show_student'

/** Final status of a class once its room has finished. Pure. */
export function decideClassOutcome(input: {
  hostJoined: boolean
  otherAttendees: number
  expectedStudents: number
}): ClassOutcome {
  if (!input.hostJoined) return 'no_show_teacher'
  if (input.expectedStudents > 0 && input.otherAttendees === 0) return 'no_show_student'
  return 'completed'
}

export type RoomFinishedStatus = ClassOutcome | 'scheduled'

export interface RoomFinishedInput {
  now: Date
  scheduledAt: string
  durationMinutes: number | null
  status: string
  hostJoined: boolean
  /** Attendees that are invited students / the private-class participant (not the host or observers). */
  studentAttendees: number
  expectedStudents: number
}

const MINUTE_MS = 60_000
const DEFAULT_DURATION_MINUTES = 60

/**
 * What to do with a class when its room finished (or when the cron finds one nobody joined).
 * The outcome is only final once the class's scheduled end has passed; earlier room closures
 * (e.g. a student joined early and left) never change the status, except a `live` class
 * that finished before its scheduled start goes back to `scheduled`. Pure.
 */
export function decideRoomFinished(input: RoomFinishedInput): { status: RoomFinishedStatus | null; notify: boolean } {
  if (input.status !== 'scheduled' && input.status !== 'live') return { status: null, notify: false }
  const start = new Date(input.scheduledAt).getTime()
  const duration = input.durationMinutes && input.durationMinutes > 0 ? input.durationMinutes : DEFAULT_DURATION_MINUTES
  const end = start + duration * MINUTE_MS
  const now = input.now.getTime()

  if (now < end) {
    if (input.status === 'live' && now < start) return { status: 'scheduled', notify: false }
    return { status: null, notify: false }
  }

  const outcome = decideClassOutcome({
    hostJoined: input.hostJoined,
    otherAttendees: input.studentAttendees,
    expectedStudents: input.expectedStudents,
  })
  return { status: outcome, notify: outcome !== 'completed' }
}
