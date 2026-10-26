import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { notifyUser } from "@/lib/notifications"
import { reportError } from "@/lib/observability/report-error"
import { purgeExpiredRecordings } from "@/lib/recordings/retention"
import { decideRoomFinished } from "@/lib/livekit/class-outcome"
import { loadClassFacts, notifyMissedClass } from "@/lib/classes/outcome-notify"
import { DEFAULT_TIMEZONE, meetingAudience, runGeneration } from "@/lib/classes/timetable"

/**
 * GET /api/cron/classes — every 10 minutes (pg_cron) with a daily Vercel fallback.
 *  1. Generate the next 14 days of timetable classes.
 *  2. Send "class starts soon" reminders (once per class).
 *  3. Resolve timetable classes nobody joined (no room => no webhook).
 *  4. Purge recordings past their retention date.
 * Each step is independent: one failing never stops the others.
 */

export const maxDuration = 60

const REMINDER_WINDOW_MS = 60 * 60 * 1000
const MAX_REMINDERS = 200
const OUTCOME_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000
const OUTCOME_GRACE_MS = 15 * 60 * 1000
const MAX_OUTCOMES = 200

interface DueMeeting {
  id: string
  title: string
  organizer_id: string
  participant_id: string | null
  scheduled_at: string
}

function clock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: DEFAULT_TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
}

async function sendReminders(): Promise<number> {
  const admin = createAdminClient()
  const now = Date.now()
  const { data, error } = await admin
    .from("meetings")
    .select("id, title, organizer_id, participant_id, scheduled_at")
    .eq("status", "scheduled")
    .is("reminder_sent_at", null)
    .gte("scheduled_at", new Date(now).toISOString())
    .lte("scheduled_at", new Date(now + REMINDER_WINDOW_MS).toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(MAX_REMINDERS)
  if (error) throw error

  let sent = 0
  for (const m of (data ?? []) as DueMeeting[]) {
    // Claim first so overlapping cron runs never double-send.
    const { data: claimed, error: claimError } = await admin
      .from("meetings")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", m.id)
      .is("reminder_sent_at", null)
      .select("id")
    if (claimError) {
      reportError(claimError, { where: "cron.classes.claim", meetingId: m.id })
      continue
    }
    if (!claimed || claimed.length === 0) continue

    const audience = await meetingAudience(admin, m)
    await Promise.all(
      audience.map((userId) =>
        notifyUser({
          userId,
          type: "meeting_invite",
          title: `Class starts at ${clock(m.scheduled_at)}`,
          message: `"${m.title}" starts at ${clock(m.scheduled_at)} — Join from your dashboard.`,
          actionUrl: `/meet/${m.id}`,
        })
      )
    )
    sent++
  }
  return sent
}

interface UnresolvedMeeting {
  id: string
  title: string | null
  organizer_id: string
  participant_id: string | null
  scheduled_at: string
  duration_minutes: number | null
}

async function resolveUnjoinedClasses(): Promise<number> {
  const admin = createAdminClient()
  const now = new Date()
  const { data, error } = await admin
    .from("meetings")
    .select("id, title, organizer_id, participant_id, scheduled_at, duration_minutes")
    .not("timetable_slot_id", "is", null)
    .eq("status", "scheduled")
    .gte("scheduled_at", new Date(now.getTime() - OUTCOME_LOOKBACK_MS).toISOString())
    .lte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(MAX_OUTCOMES)
  if (error) throw error

  let resolved = 0
  for (const m of (data ?? []) as UnresolvedMeeting[]) {
    const endsAt = new Date(m.scheduled_at).getTime() + (m.duration_minutes ?? 60) * 60_000
    if (endsAt + OUTCOME_GRACE_MS >= now.getTime()) continue
    try {
      const facts = await loadClassFacts(admin, m)
      const decision = decideRoomFinished({
        now,
        scheduledAt: m.scheduled_at,
        durationMinutes: m.duration_minutes,
        status: "scheduled",
        hostJoined: facts.hostJoined,
        studentAttendees: facts.studentAttendees,
        expectedStudents: facts.expectedStudents,
      })
      if (!decision.status || decision.status === "scheduled") continue
      const { data: updated, error: updateError } = await admin
        .from("meetings")
        .update({ status: decision.status })
        .eq("id", m.id)
        .eq("status", "scheduled")
        .select("id")
      if (updateError) throw updateError
      if (!updated || updated.length === 0) continue
      resolved++
      if (decision.notify && decision.status !== "completed") await notifyMissedClass(m, decision.status, facts.students)
    } catch (error: unknown) {
      reportError(error, { where: "cron.classes.outcome", meetingId: m.id })
    }
  }
  return resolved
}

async function step<T>(name: string, fn: () => Promise<T>): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  try {
    return { ok: true, result: await fn() }
  } catch (error: unknown) {
    reportError(error, { where: `cron.classes.${name}` })
    return { ok: false, error: error instanceof Error ? error.message : "failed" }
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const expected = Buffer.from(`Bearer ${secret ?? ""}`)
  const given = Buffer.from(request.headers.get("authorization") ?? "")
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const generation = await step("generate", async () => {
    const result = await runGeneration(createAdminClient())
    if (!result) throw new Error("generate_class_meetings failed")
    return result
  })
  const reminders = await step("reminders", sendReminders)
  const outcomes = await step("outcomes", resolveUnjoinedClasses)
  const recordings = await step("recordings", () => purgeExpiredRecordings())

  return NextResponse.json({ generation, reminders, outcomes, recordings })
}
