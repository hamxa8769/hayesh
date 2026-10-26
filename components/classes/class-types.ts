/** Shapes returned by the classroom APIs (see the Sprint 2 contract). */

export interface UpcomingClass {
  id: string
  title: string
  agenda: string | null
  scheduled_at: string
  duration_minutes: number | null
  status: string
  is_group: boolean
  isHost: boolean
  timetable_slot_id: string | null
  studentCount: number
  teacherName: string | null
}

export interface UpcomingResponse {
  serverNow: string
  items: UpcomingClass[]
}

export interface SlotMember {
  subscription_id: string
  child_name: string | null
  subject: string | null
  subscription_status: string | null
  parent_name: string | null
}

export interface TimetableSlot {
  id: string
  title: string
  subject: string | null
  weekday: number
  start_time: string
  duration_minutes: number
  timezone: string
  is_group: boolean
  active: boolean
  members: SlotMember[]
}

export interface Enrolment {
  id: string
  child_name: string
  subject: string
  tier: string | null
  status: string
  parent_name: string | null
}

export interface TimetableResponse {
  slots: TimetableSlot[]
  enrolments: Enrolment[]
}

/** Display order Mon → Sun, using JS/Postgres weekday numbers (0 = Sunday). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const
export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const
export const DURATION_OPTIONS = [30, 45, 60, 90, 120] as const

export async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const json = (await res.json()) as { error?: string }
    return json.error ?? fallback
  } catch {
    return fallback
  }
}

/** "14:30:00" -> "14:30" */
export function hhmm(time: string): string {
  return time.slice(0, 5)
}

export function addMinutesToHhmm(time: string, minutes: number): string {
  const [h, m] = hhmm(time).split(":").map(Number)
  const total = Math.min(h * 60 + m + minutes, 24 * 60)
  const hh = Math.floor(total / 60) % 24
  return `${String(hh).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

export function formatLocalTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }).format(date)
}

export function formatLocalDateTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso))
}
