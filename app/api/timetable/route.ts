import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimit } from "@/lib/security/rate-limit"
import { reportError } from "@/lib/observability/report-error"
import { scheduleErrorMessage } from "@/lib/classes/errors"
import { normalizeTimezone, resolveApprovedTeacher, runGeneration, slotCreateSchema } from "@/lib/classes/timetable"

interface ProfileRef {
  full_name: string | null
}

interface SubRow {
  id: string
  child_name: string
  subject: string
  tier?: string
  status: string
  parent: ProfileRef | ProfileRef[] | null
}

function parentName(p: ProfileRef | ProfileRef[] | null): string | null {
  const row = Array.isArray(p) ? p[0] : p
  return row?.full_name ?? null
}

interface SlotRow {
  id: string
  timetable_slot_members: Array<{ subscription_id: string; subscription: SubRow | SubRow[] | null }> | null
  [key: string]: unknown
}

const SUB_SELECT = "id, child_name, subject, tier, status, parent:profiles!subscriptions_parent_id_fkey(full_name)"

export async function GET() {
  const auth = await requireUser(["teacher"])
  if (!auth.ok) return auth.response

  const admin = createAdminClient()
  const lookup = await resolveApprovedTeacher(admin, auth.user.userId)
  if (!lookup.ok) return NextResponse.json({ error: lookup.error }, { status: lookup.status })

  const [slotsRes, subsRes] = await Promise.all([
    admin
      .from("timetable_slots")
      .select(`*, timetable_slot_members(subscription_id, subscription:subscriptions(${SUB_SELECT}))`)
      .eq("teacher_id", lookup.teacher.id)
      .order("weekday", { ascending: true })
      .order("start_time", { ascending: true }),
    admin
      .from("subscriptions")
      .select(SUB_SELECT)
      .eq("teacher_id", lookup.teacher.id)
      .in("status", ["active", "pending_payment"])
      .order("created_at", { ascending: false })
      .limit(500),
  ])
  if (slotsRes.error || subsRes.error) {
    reportError(slotsRes.error ?? subsRes.error, { where: "timetable.get" })
    return NextResponse.json({ error: "Could not load your timetable" }, { status: 500 })
  }

  const slots = ((slotsRes.data ?? []) as unknown as SlotRow[]).map(({ timetable_slot_members, ...slot }) => ({
    ...slot,
    members: (timetable_slot_members ?? []).map((m) => {
      const sub = Array.isArray(m.subscription) ? m.subscription[0] : m.subscription
      return {
        subscription_id: m.subscription_id,
        child_name: sub?.child_name ?? null,
        subject: sub?.subject ?? null,
        subscription_status: sub?.status ?? null,
        parent_name: sub ? parentName(sub.parent) : null,
      }
    }),
  }))

  const enrolments = ((subsRes.data ?? []) as unknown as SubRow[]).map((s) => ({
    id: s.id,
    child_name: s.child_name,
    subject: s.subject,
    tier: s.tier ?? null,
    status: s.status,
    parent_name: parentName(s.parent),
  }))

  return NextResponse.json({ slots, enrolments })
}

export async function POST(request: Request) {
  const auth = await requireUser(["teacher"])
  if (!auth.ok) return auth.response

  const limited = await rateLimit(`timetable:${auth.user.userId}`, 30, 60 * 60 * 1000)
  if (!limited.ok) {
    return NextResponse.json({ error: `Too many requests — try again in ${limited.retryAfterSeconds} seconds` }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = slotCreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  const v = parsed.data
  if (!v.is_group && v.subscription_ids.length !== 1) {
    return NextResponse.json({ error: "A private class has exactly one student" }, { status: 400 })
  }
  const memberIds = [...new Set(v.subscription_ids)]

  const admin = createAdminClient()
  const lookup = await resolveApprovedTeacher(admin, auth.user.userId)
  if (!lookup.ok) return NextResponse.json({ error: lookup.error }, { status: lookup.status })

  const insert: Record<string, unknown> = {
    teacher_id: lookup.teacher.id,
    title: v.title,
    subject: v.subject || null,
    weekday: v.weekday,
    start_time: v.start_time,
    duration_minutes: v.duration_minutes,
    is_group: v.is_group,
    timezone: normalizeTimezone(v.timezone),
  }
  if (v.starts_on) insert.starts_on = v.starts_on
  if (v.ends_on) insert.ends_on = v.ends_on

  const { data: slot, error: slotError } = await admin.from("timetable_slots").insert(insert).select("*").maybeSingle()
  if (slotError || !slot) {
    const friendly = scheduleErrorMessage(slotError)
    if (friendly) return NextResponse.json({ error: friendly }, { status: 409 })
    reportError(slotError ?? "slot not created", { where: "timetable.create" })
    return NextResponse.json({ error: "Could not create the class slot" }, { status: 400 })
  }

  const slotId = (slot as { id: string }).id
  const { error: memberError } = await admin
    .from("timetable_slot_members")
    .insert(memberIds.map((subscription_id) => ({ slot_id: slotId, subscription_id })))
  if (memberError) {
    await admin.from("timetable_slots").delete().eq("id", slotId)
    const friendly = scheduleErrorMessage(memberError)
    if (friendly) return NextResponse.json({ error: friendly }, { status: 409 })
    reportError(memberError, { where: "timetable.create.members" })
    return NextResponse.json({ error: "Could not add students to the class" }, { status: 400 })
  }

  const generation = await runGeneration(admin)
  return NextResponse.json({ slot, generation }, { status: 201 })
}
