import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { notifyUser } from "@/lib/notifications"
import type { DemoBooking, DemoBookingStatus } from "@/types/database"

/**
 * PATCH /api/teacher/demo-bookings — a teacher confirms, declines, or marks
 * complete one of THEIR OWN demo bookings.
 *
 * Migration 006 ("Teacher updates own demo bookings") already lets a teacher
 * UPDATE any demo_bookings row where `teacher_id in (select id from
 * public.teachers where user_id = auth.uid())` — so a teacher CAN do this
 * confirm/decline update directly from the browser client via RLS alone.
 * This route exists anyway for three reasons a client-side update cannot
 * provide:
 *   1. A status *transition* guard (`.eq('status', fromStatus)`) so two
 *      teacher tabs (or a double click) can't both "win" a confirm/decline
 *      race — the second request affects zero rows and gets a clean 409
 *      instead of silently re-writing an already-handled booking.
 *   2. Notifying the PARENT (a different user) requires the service-role
 *      client in lib/notifications.ts — RLS on public.notifications only
 *      allows `user_id = auth.uid()`, which a parent-targeted insert from
 *      the teacher's own session can never satisfy.
 *   3. A single typed JSON contract for the three actions instead of three
 *      slightly-different client-side Supabase calls scattered in the UI.
 *
 * Authorization is enforced TWICE, deliberately: the `.eq('teacher_id', ...)`
 * scope below stops a teacher from ever touching another teacher's booking
 * at the application layer, and the underlying RLS policy enforces the same
 * boundary independently at the database layer even if this route had a bug.
 */

type Action = "confirm" | "decline" | "complete"

interface Transition {
  from: DemoBookingStatus
  to: DemoBookingStatus
}

const TRANSITIONS: Record<Action, Transition> = {
  confirm: { from: "pending", to: "confirmed" },
  decline: { from: "pending", to: "cancelled" },
  complete: { from: "confirmed", to: "completed" },
}

const patchSchema = z.object({
  booking_id: z.string().uuid("Invalid booking id"),
  action: z.enum(["confirm", "decline", "complete"], { error: "Invalid action" }),
})

interface PatchSuccessResponse {
  booking: DemoBooking
}

interface PatchErrorResponse {
  error: string
}

export async function PATCH(
  request: Request
): Promise<NextResponse<PatchSuccessResponse | PatchErrorResponse>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if ((profile as { role?: string } | null)?.role !== "teacher") {
    return NextResponse.json({ error: "Only teachers can act on demo bookings" }, { status: 403 })
  }

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, display_name")
    .eq("user_id", user.id)
    .maybeSingle()

  const teacherRow = teacher as { id: string; display_name: string | null } | null
  if (!teacherRow) {
    return NextResponse.json({ error: "No teacher profile found for this account" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    )
  }

  const { booking_id, action } = parsed.data
  const transition = TRANSITIONS[action as Action]

  // Scoped to THIS teacher's own booking AND the expected current status in
  // one query — a booking that belongs to another teacher, or has already
  // been handled (confirmed/declined/completed) by the time this request
  // lands, matches zero rows instead of silently overwriting it.
  const { data, error } = await supabase
    .from("demo_bookings")
    .update({ status: transition.to })
    .eq("id", booking_id)
    .eq("teacher_id", teacherRow.id)
    .eq("status", transition.from)
    .select("*")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (!data) {
    return NextResponse.json(
      { error: "This request was already handled, doesn't exist, or isn't yours." },
      { status: 409 }
    )
  }

  const booking = data as DemoBooking

  if (action === "confirm") {
    // Notification failure must never fail the request — the confirm has
    // already committed by this point.
    await notifyUser({
      userId: booking.parent_id,
      type: "demo_booked",
      title: "Demo lesson confirmed",
      message: `${teacherRow.display_name ?? "Your teacher"} confirmed the demo for ${booking.child_name} (${booking.subject}).`,
      actionUrl: "/parent/requests",
    })
  }

  return NextResponse.json({ booking })
}
