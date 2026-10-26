import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimit } from "@/lib/security/rate-limit"
import { reportError } from "@/lib/observability/report-error"
import { scheduleErrorMessage } from "@/lib/classes/errors"
import {
  cancelFutureSlotMeetings,
  normalizeTimezone,
  resolveApprovedTeacher,
  runGeneration,
  slotPatchSchema,
} from "@/lib/classes/timetable"

interface SlotRecord {
  id: string
  teacher_id: string
  title: string
  weekday: number
  start_time: string
  duration_minutes: number
  timezone: string
  is_group: boolean
  active: boolean
}

type Params = { params: Promise<{ id: string }> }
type Failure = NextResponse<{ error: string }>

const idSchema = z.string().uuid()

function failure(error: { code?: string; message?: string } | null, fallback: string, where: string): Failure {
  const friendly = scheduleErrorMessage(error)
  if (friendly) return NextResponse.json({ error: friendly }, { status: 409 })
  reportError(error ?? fallback, { where })
  return NextResponse.json({ error: fallback }, { status: 400 })
}

async function authorize(id: string): Promise<{ admin: SupabaseClient; userId: string; slot: SlotRecord } | Failure> {
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  const auth = await requireUser(["teacher"])
  if (!auth.ok) return auth.response
  const limited = await rateLimit(`timetable:${auth.user.userId}`, 30, 60 * 60 * 1000)
  if (!limited.ok) {
    return NextResponse.json({ error: `Too many requests — try again in ${limited.retryAfterSeconds} seconds` }, { status: 429 })
  }
  const admin = createAdminClient()
  const lookup = await resolveApprovedTeacher(admin, auth.user.userId)
  if (!lookup.ok) return NextResponse.json({ error: lookup.error }, { status: lookup.status })
  const { data } = await admin.from("timetable_slots").select("*").eq("id", id).maybeSingle()
  const slot = data as SlotRecord | null
  if (!slot || slot.teacher_id !== lookup.teacher.id) return NextResponse.json({ error: "Class slot not found" }, { status: 404 })
  return { admin, userId: auth.user.userId, slot }
}

/** Replaces the member set; restores the old one if the new one is rejected. */
async function replaceMembers(admin: SupabaseClient, slotId: string, next: string[]): Promise<{ error: { code?: string; message?: string } | null; oldParent: string | null; newParent: string | null }> {
  const { data: old } = await admin.from("timetable_slot_members").select("subscription_id").eq("slot_id", slotId)
  const oldIds = ((old ?? []) as Array<{ subscription_id: string }>).map((r) => r.subscription_id)
  const toRemove = oldIds.filter((s) => !next.includes(s))
  const toAdd = next.filter((s) => !oldIds.includes(s))
  if (toRemove.length === 0 && toAdd.length === 0) return { error: null, oldParent: null, newParent: null }

  if (toRemove.length > 0) {
    const { error } = await admin.from("timetable_slot_members").delete().eq("slot_id", slotId).in("subscription_id", toRemove)
    if (error) return { error, oldParent: null, newParent: null }
  }
  if (toAdd.length > 0) {
    const { error } = await admin.from("timetable_slot_members").insert(toAdd.map((subscription_id) => ({ slot_id: slotId, subscription_id })))
    if (error) {
      if (toRemove.length > 0) await admin.from("timetable_slot_members").insert(toRemove.map((subscription_id) => ({ slot_id: slotId, subscription_id })))
      return { error, oldParent: null, newParent: null }
    }
  }
  const { data: subs } = await admin.from("subscriptions").select("id, parent_id").in("id", [...toRemove, ...toAdd])
  const parentOf = new Map(((subs ?? []) as Array<{ id: string; parent_id: string }>).map((s) => [s.id, s.parent_id]))
  return { error: null, oldParent: toRemove[0] ? parentOf.get(toRemove[0]) ?? null : null, newParent: toAdd[0] ? parentOf.get(toAdd[0]) ?? null : null }
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const ctx = await authorize(id)
  if (ctx instanceof NextResponse) return ctx
  const { admin, slot } = ctx

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = slotPatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  const { subscription_ids, ...fields } = parsed.data

  const isGroup = fields.is_group ?? slot.is_group
  const memberIds = subscription_ids ? [...new Set(subscription_ids)] : null
  if (!memberIds && fields.is_group === false && slot.is_group) {
    const { count } = await admin.from("timetable_slot_members").select("subscription_id", { count: "exact", head: true }).eq("slot_id", id)
    if ((count ?? 0) > 1) return NextResponse.json({ error: "A private class has exactly one student" }, { status: 400 })
  }
  if (memberIds && !isGroup && memberIds.length !== 1) {
    return NextResponse.json({ error: "A private class has exactly one student" }, { status: 400 })
  }

  const update: Record<string, unknown> = { ...fields }
  if (fields.timezone !== undefined) update.timezone = normalizeTimezone(fields.timezone)
  if (typeof fields.subject === "string" && fields.subject === "") update.subject = null

  const next = {
    weekday: fields.weekday ?? slot.weekday,
    start_time: fields.start_time ?? slot.start_time,
    timezone: (update.timezone as string | undefined) ?? slot.timezone,
  }
  const timingChanged =
    next.weekday !== slot.weekday ||
    next.start_time.slice(0, 5) !== slot.start_time.slice(0, 5) ||
    next.timezone !== slot.timezone
  const durationChanged = fields.duration_minutes !== undefined && fields.duration_minutes !== slot.duration_minutes

  if (Object.keys(update).length > 0) {
    const { error } = await admin.from("timetable_slots").update(update).eq("id", id)
    if (error) return failure(error, "Could not update the class slot", "timetable.patch")
  }

  let swap = { oldParent: null as string | null, newParent: null as string | null }
  if (memberIds) {
    const result = await replaceMembers(admin, id, memberIds)
    if (result.error) {
      // Put the slot back exactly as it was so a rejected edit changes nothing.
      const original = Object.fromEntries(Object.keys(update).map((k) => [k, (slot as unknown as Record<string, unknown>)[k]]))
      if (Object.keys(original).length > 0) await admin.from("timetable_slots").update(original).eq("id", id)
      return failure(result.error, "Could not update the students in this class", "timetable.patch.members")
    }
    swap = result
  }

  const title = (fields.title ?? slot.title)
  if (timingChanged) {
    await cancelFutureSlotMeetings(admin, id, title, "the teacher changed the weekly time")
  } else {
    const patch: Record<string, unknown> = {}
    if (durationChanged) patch.duration_minutes = fields.duration_minutes
    if (fields.title !== undefined) patch.title = fields.title
    if (fields.subject !== undefined) patch.agenda = update.subject ?? null
    if (Object.keys(patch).length > 0) {
      const { error } = await admin.from("meetings").update(patch).eq("timetable_slot_id", id).eq("status", "scheduled").gt("scheduled_at", new Date().toISOString())
      if (error) reportError(error, { where: "timetable.patch.sync_meetings", slotId: id })
    }
    // Private class handed to another student: repoint future classes.
    if (!isGroup && swap.newParent && swap.oldParent !== swap.newParent) {
      const { error } = await admin
        .from("meetings")
        .update({ participant_id: swap.newParent })
        .eq("timetable_slot_id", id)
        .eq("status", "scheduled")
        .gt("scheduled_at", new Date().toISOString())
      if (error) reportError(error, { where: "timetable.patch.swap_participant", slotId: id })
    }
  }
  if (update.active === false) await cancelFutureSlotMeetings(admin, id, title, "this class was paused by the teacher")

  const generation = await runGeneration(admin)
  const { data: updated } = await admin.from("timetable_slots").select("*").eq("id", id).maybeSingle()
  return NextResponse.json({ slot: updated, generation })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const ctx = await authorize(id)
  if (ctx instanceof NextResponse) return ctx
  const { admin, slot } = ctx

  const { error } = await admin.from("timetable_slots").update({ active: false }).eq("id", id)
  if (error) return failure(error, "Could not remove the class slot", "timetable.delete")
  await cancelFutureSlotMeetings(admin, id, slot.title, "this class was removed from the timetable")
  const generation = await runGeneration(admin)
  return NextResponse.json({ ok: true, generation })
}
