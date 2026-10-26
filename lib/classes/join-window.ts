/** How long before the scheduled start a class room opens, and how long after it closes to new joiners. */
export const JOIN_EARLY_MINUTES = 10
export const JOIN_LATE_MINUTES = 15

const MINUTE_MS = 60_000
const DEFAULT_DURATION_MINUTES = 60

interface JoinWindowInput {
  scheduled_at: string
  duration_minutes: number | null
}

/** The interval during which participants may enter the room. Pure. */
export function joinWindow(m: JoinWindowInput): { opensAt: Date; closesAt: Date } {
  const start = new Date(m.scheduled_at).getTime()
  const duration = m.duration_minutes && m.duration_minutes > 0 ? m.duration_minutes : DEFAULT_DURATION_MINUTES
  return {
    opensAt: new Date(start - JOIN_EARLY_MINUTES * MINUTE_MS),
    closesAt: new Date(start + (duration + JOIN_LATE_MINUTES) * MINUTE_MS),
  }
}

export function isWithinJoinWindow(m: JoinWindowInput, now: Date = new Date()): boolean {
  const { opensAt, closesAt } = joinWindow(m)
  const t = now.getTime()
  if (Number.isNaN(opensAt.getTime())) return false
  return t >= opensAt.getTime() && t <= closesAt.getTime()
}
