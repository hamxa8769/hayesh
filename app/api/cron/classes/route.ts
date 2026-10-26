import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { notifyUser } from "@/lib/notifications"
import { reportError } from "@/lib/observability/report-error"
import { purgeExpiredRecordings } from "@/lib/recordings/retention"
import { DEFAULT_TIMEZONE, meetingAudience, runGeneration } from "@/lib/classes/timetable"

/**
 * GET /api/cron/classes — every 10 minutes (pg_cron) with a daily Vercel fallback.
 *  1. Generate the next 14 days of timetable classes.
 *  2. Send "class starts soon" reminders (once per class).
 *  3. Purge recordings past their retention date.
 * Each step is independent: one failing never stops the others.
 */

export const maxDuration = 60

const REMINDER_WINDOW_MS = 60 * 60 * 1000
const MAX_REMINDERS = 200

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
  const recordings = await step("recordings", () => purgeExpiredRecordings())

  return NextResponse.json({ generation, reminders, recordings })
}
