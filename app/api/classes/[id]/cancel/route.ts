import { NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimit } from "@/lib/security/rate-limit"
import { reportError } from "@/lib/observability/report-error"
import { formatClassTime, meetingAudience, notifyAll } from "@/lib/classes/timetable"

const bodySchema = z.object({ reason: z.string().trim().max(300).optional() })

interface MeetingRow {
  id: string
  title: string
  organizer_id: string
  participant_id: string | null
  scheduled_at: string
  status: string
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const auth = await requireUser(["teacher", "seller"])
  if (!auth.ok) return auth.response

  const limited = await rateLimit(`class-cancel:${auth.user.userId}`, 60, 60 * 60 * 1000)
  if (!limited.ok) {
    return NextResponse.json({ error: `Too many requests — try again in ${limited.retryAfterSeconds} seconds` }, { status: 429 })
  }

  let body: unknown = {}
  try {
    const text = await request.text()
    if (text) body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })

  const admin = createAdminClient()
  const { data } = await admin
    .from("meetings")
    .select("id, title, organizer_id, participant_id, scheduled_at, status")
    .eq("id", id)
    .maybeSingle()
  const meeting = data as MeetingRow | null
  if (!meeting || (meeting.organizer_id !== auth.user.userId && auth.user.role !== "admin")) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 })
  }
  if (meeting.status !== "scheduled") return NextResponse.json({ error: "Only an upcoming scheduled class can be cancelled" }, { status: 409 })
  if (new Date(meeting.scheduled_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "This class has already started" }, { status: 409 })
  }

  // Conditional update: a concurrent start/cancel wins cleanly.
  const { data: updated, error } = await admin
    .from("meetings")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle()
  if (error) {
    reportError(error, { where: "classes.cancel", meetingId: id })
    return NextResponse.json({ error: "Could not cancel the class" }, { status: 500 })
  }
  if (!updated) return NextResponse.json({ error: "This class can no longer be cancelled" }, { status: 409 })

  const reason = parsed.data.reason
  const audience = await meetingAudience(admin, meeting, auth.user.userId)
  await notifyAll(audience, {
    type: "meeting_cancelled",
    title: "Class cancelled",
    message: `"${meeting.title}" on ${formatClassTime(meeting.scheduled_at)} was cancelled.${reason ? ` Reason: ${reason}` : ""}`,
    actionUrl: "/meetings",
  })
  return NextResponse.json({ ok: true })
}
