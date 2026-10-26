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
