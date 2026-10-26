import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { reportError } from "@/lib/observability/report-error"

const HOUR_MS = 60 * 60 * 1000
const MAX_ITEMS = 100

interface MeetingRow {
  id: string
  title: string
  agenda: string | null
  scheduled_at: string
  duration_minutes: number | null
  status: string
  is_group: boolean
  organizer_id: string
  timetable_slot_id: string | null
  organizer: { full_name: string | null } | Array<{ full_name: string | null }> | null
  meeting_invitations: Array<{ invitee_id: string }> | null
}

const SELECT =
  "id, title, agenda, scheduled_at, duration_minutes, status, is_group, organizer_id, timetable_slot_id, organizer:profiles!meetings_organizer_id_fkey(full_name), meeting_invitations(invitee_id)"

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const me = auth.user.userId

  const now = Date.now()
  const from = new Date(now - 3 * HOUR_MS).toISOString()
  const to = new Date(now + 7 * 24 * HOUR_MS).toISOString()
  const admin = createAdminClient()

  const { data: inviteRows, error: inviteError } = await admin.from("meeting_invitations").select("meeting_id").eq("invitee_id", me).limit(1000)
  if (inviteError) {
    reportError(inviteError, { where: "classes.upcoming.invites" })
    return NextResponse.json({ error: "Could not load classes" }, { status: 500 })
  }
  const invitedIds = ((inviteRows ?? []) as Array<{ meeting_id: string }>).map((r) => r.meeting_id)
  const filter = [`organizer_id.eq.${me}`, `participant_id.eq.${me}`, ...(invitedIds.length > 0 ? [`id.in.(${invitedIds.join(",")})`] : [])].join(",")

  const { data, error } = await admin
    .from("meetings")
    .select(SELECT)
    .in("status", ["scheduled", "live"])
    .gte("scheduled_at", from)
    .lte("scheduled_at", to)
    .or(filter)
    .order("scheduled_at", { ascending: true })
    .limit(MAX_ITEMS)
  if (error) {
    reportError(error, { where: "classes.upcoming" })
    return NextResponse.json({ error: "Could not load classes" }, { status: 500 })
  }

  const items = ((data ?? []) as unknown as MeetingRow[]).map((m) => {
    const organizer = Array.isArray(m.organizer) ? m.organizer[0] : m.organizer
    return {
      id: m.id,
      title: m.title,
      agenda: m.agenda,
      scheduled_at: m.scheduled_at,
      duration_minutes: m.duration_minutes,
      status: m.status,
      is_group: m.is_group,
      isHost: m.organizer_id === me,
      timetable_slot_id: m.timetable_slot_id,
      studentCount: m.meeting_invitations?.length ?? 0,
      teacherName: organizer?.full_name ?? null,
    }
  })
  return NextResponse.json({ serverNow: new Date(now).toISOString(), items })
}
