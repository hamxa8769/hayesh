const SCHEDULE_PREFIXES = ["schedule_conflict", "invalid_member", "private_slot_full"] as const

/**
 * Friendly text for the P0001 errors raised by the timetable / double-booking
 * triggers (message format "<code>: <human text>"). Returns null otherwise.
 */
export function scheduleErrorMessage(error: { code?: string; message?: string } | null): string | null {
  if (!error || error.code !== "P0001" || !error.message) return null
  const message = error.message
  const matches = SCHEDULE_PREFIXES.some((prefix) => message.startsWith(`${prefix}:`))
  if (!matches) return null
  const human = message.slice(message.indexOf(":") + 1).trim()
  if (human.length === 0) return "This time conflicts with your existing schedule"
  return human.charAt(0).toUpperCase() + human.slice(1)
}
