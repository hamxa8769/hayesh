import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { notifyTeacherByTeacherId } from "@/lib/notifications"

/**
 * POST /api/demo-bookings — parent requests a free demo lesson with a teacher.
 *
 * Uses the normal server Supabase client (cookie-based, RLS-scoped), not the
 * service-role admin client, so the "Parent books demos" RLS policy in
 * migration 006 (`with check (parent_id = auth.uid())`) is the thing that
 * actually enforces the ownership guarantee below — this route mirrors that
 * guarantee at the application layer for a clean error message, it does not
 * replace it.
 */

const demoBookingSchema = z.object({
  teacher_id: z.string().uuid("Invalid teacher"),
  child_name: z.string().trim().min(2, "Enter your child's name").max(100, "Keep it under 100 characters"),
  child_age: z.number().int().min(3, "Age must be at least 3").max(25, "Age must be 25 or under").optional(),
  subject: z.string().trim().min(1, "Subject is required").max(100, "Keep it under 100 characters"),
  scheduled_at: z.string().min(1, "scheduled_at is required"),
  notes: z.string().trim().max(500, "Keep it under 500 characters").optional(),
})

interface DemoBookingSuccessResponse {
  id: string
}

interface DemoBookingErrorResponse {
  error: string
}

export async function POST(
  request: Request
): Promise<NextResponse<DemoBookingSuccessResponse | DemoBookingErrorResponse>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = demoBookingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }

  const values = parsed.data

  const scheduledAt = new Date(values.scheduled_at)
  if (Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: "scheduled_at must be a valid date" }, { status: 400 })
  }
  if (scheduledAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "scheduled_at must be in the future" }, { status: 400 })
  }

  // Only parent accounts may book demos. This doubles as authorization: a
  // teacher, seller, or admin account hitting this route is rejected here
  // rather than relying solely on RLS to fail the insert.
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()

  if (profile?.role !== "parent") {
    return NextResponse.json({ error: "Only parent accounts can book a demo lesson" }, { status: 403 })
  }

  // parent_id is ALWAYS taken from the authenticated session — never from
  // the request body — so no caller can book a demo on another parent's
  // behalf.
  const { data, error } = await supabase
    .from("demo_bookings")
    .insert({
      teacher_id: values.teacher_id,
      parent_id: user.id,
      child_name: values.child_name,
      child_age: values.child_age ?? null,
      subject: values.subject,
      scheduled_at: scheduledAt.toISOString(),
      notes: values.notes || null,
      status: "pending",
    })
    .select("id")
    .maybeSingle()

  if (error) {
    // Surfaces the real Supabase error (e.g. an FK violation for a bad
    // teacher_id) instead of a generic 500.
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (!data) {
    return NextResponse.json({ error: "Demo booking was not created" }, { status: 400 })
  }

  // Tell the teacher a demo is waiting on them. notifyTeacherByTeacherId
  // resolves teachers.user_id internally. The helper never throws and the
  // booking has already committed, so a notification failure must not turn a
  // successful booking into an error for the parent.
  await notifyTeacherByTeacherId({
    teacherId: values.teacher_id,
    type: "demo_booked",
    title: "New demo request",
    message: `A parent requested a free demo for ${values.subject}.`,
    actionUrl: "/teacher/sessions",
  })

  return NextResponse.json({ id: data.id })
}
