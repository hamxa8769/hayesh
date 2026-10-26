import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { notifyUser, type NotificationType } from "@/lib/notifications"
import { reportError } from "@/lib/observability/report-error"

export const DEFAULT_TIMEZONE = "Asia/Karachi"
export const GENERATE_DAYS = 14

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

let zoneCache: Set<string> | null = null

function supportedZones(): Set<string> {
  if (zoneCache) return zoneCache
  try {
    zoneCache = new Set(Intl.supportedValuesOf("timeZone"))
  } catch {
    zoneCache = new Set([DEFAULT_TIMEZONE])
  }
  return zoneCache
}

/** Returns the zone if recognised, otherwise the Karachi default. */
export function normalizeTimezone(zone: string | undefined): string {
  if (!zone) return DEFAULT_TIMEZONE
  if (supportedZones().has(zone)) return zone
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone })
    return zone
  } catch {
    return DEFAULT_TIMEZONE
  }
}

const time = z.string().regex(TIME_RE, "start_time must be HH:MM")
const date = z.string().regex(DATE_RE, "Dates must be YYYY-MM-DD")

export const slotCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  subject: z.string().trim().max(80).optional(),
  weekday: z.number().int().min(0).max(6),
  start_time: time,
  duration_minutes: z.number().int().min(15).max(240),
  is_group: z.boolean(),
  timezone: z.string().max(64).optional(),
  starts_on: date.optional(),
  ends_on: date.nullable().optional(),
  subscription_ids: z.array(z.string().uuid()).min(1, "Choose at least one student").max(100),
})

export const slotPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    subject: z.string().trim().max(80).nullable(),
    weekday: z.number().int().min(0).max(6),
    start_time: time,
    duration_minutes: z.number().int().min(15).max(240),
    is_group: z.boolean(),
    timezone: z.string().max(64),
    starts_on: date,
    ends_on: date.nullable(),
    active: z.boolean(),
    subscription_ids: z.array(z.string().uuid()).min(1, "Choose at least one student").max(100),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field must be provided" })

export interface TeacherRow {
  id: string
  user_id: string
  status: string
}

export type TeacherLookup =
  | { ok: true; teacher: TeacherRow }
  | { ok: false; status: number; error: string }

/** Resolves the caller's teachers row and requires approval. */
export async function resolveApprovedTeacher(admin: SupabaseClient, userId: string): Promise<TeacherLookup> {
  const { data, error } = await admin.from("teachers").select("id, user_id, status").eq("user_id", userId).maybeSingle()
  if (error) return { ok: false, status: 500, error: "Could not load your teacher profile" }
  if (!data) return { ok: false, status: 403, error: "Only teachers can manage a timetable" }
  const teacher = data as TeacherRow
  if (teacher.status !== "approved") return { ok: false, status: 403, error: "Your teacher profile must be approved first" }
  return { ok: true, teacher }
}

/** Runs the class generator; failures are reported, never thrown. */
export async function runGeneration(admin: SupabaseClient): Promise<{ created: number; conflicts: number; cancelled: number } | null> {
  const { data, error } = await admin.rpc("generate_class_meetings", { p_days: GENERATE_DAYS })
  if (error) {
    reportError(error, { where: "generate_class_meetings" })
    return null
  }
  const r = (data ?? {}) as Partial<Record<"created" | "conflicts" | "cancelled", number>>
  return { created: r.created ?? 0, conflicts: r.conflicts ?? 0, cancelled: r.cancelled ?? 0 }
}

export function formatClassTime(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
  } catch {
    return iso
  }
}

/** Everyone who should hear about a meeting: host, participant, invitees (minus `except`). */
export async function meetingAudience(
  admin: SupabaseClient,
  meeting: { id: string; organizer_id: string; participant_id: string | null },
  except?: string
): Promise<string[]> {
  const { data } = await admin.from("meeting_invitations").select("invitee_id").eq("meeting_id", meeting.id)
  const ids = new Set<string>([meeting.organizer_id])
  if (meeting.participant_id) ids.add(meeting.participant_id)
  for (const row of (data ?? []) as Array<{ invitee_id: string }>) ids.add(row.invitee_id)
  if (except) ids.delete(except)
  return [...ids]
}

export async function notifyAll(
  userIds: string[],
  content: { type: NotificationType; title: string; message: string; actionUrl?: string }
): Promise<void> {
  await Promise.all(userIds.map((userId) => notifyUser({ userId, ...content })))
}

/**
 * Cancels every future `scheduled` class of a slot and tells the affected
 * people once each (not once per class). Call BEFORE regenerating.
 */
export async function cancelFutureSlotMeetings(admin: SupabaseClient, slotId: string, title: string, reason: string): Promise<number> {
  // Future, never-started occurrences are DELETED (not marked cancelled) so
  // that resuming the slot or moving it back regenerates them; a class the
  // teacher cancels individually stays a 'cancelled' row and is never revived.
  const { data, error } = await admin
    .from("meetings")
    .select("id, organizer_id, participant_id")
    .eq("timetable_slot_id", slotId)
    .eq("status", "scheduled")
    .gt("scheduled_at", new Date().toISOString())
  if (error) {
    reportError(error, { where: "timetable.cancel_future", slotId })
    return 0
  }
  const meetings = (data ?? []) as Array<{ id: string; organizer_id: string; participant_id: string | null }>
  if (meetings.length === 0) return 0

  // Audience first: deleting a meeting cascades its invitations.
  const counts = new Map<string, number>()
  for (const m of meetings) {
    for (const userId of await meetingAudience(admin, m)) counts.set(userId, (counts.get(userId) ?? 0) + 1)
  }
  const { error: deleteError } = await admin
    .from("meetings")
    .delete()
    .in("id", meetings.map((m) => m.id))
    .eq("status", "scheduled")
  if (deleteError) {
    reportError(deleteError, { where: "timetable.cancel_future.delete", slotId })
    return 0
  }
  await Promise.all(
    [...counts].map(([userId, n]) =>
      notifyUser({
        userId,
        type: "meeting_cancelled",
        title: "Class schedule changed",
        message: `${n} upcoming ${n === 1 ? "class" : "classes"} of "${title}" ${n === 1 ? "was" : "were"} cancelled: ${reason}.`,
        actionUrl: "/meetings",
      })
    )
  )
  return meetings.length
}
