import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { notifyTeacherByTeacherId, notifyUser } from "@/lib/notifications"

/**
 * POST /api/admin/assign-teacher
 *
 * Admin action on a public.student_requests row: assign an approved teacher
 * or decline the request. Migration 010 revoked UPDATE on
 * assigned_teacher_id / assigned_by / assigned_at / status from the
 * `authenticated` role (see supabase-migrations/010-student-workflow-and-support.sql),
 * so a browser-side supabase.update() of those columns is rejected by
 * Postgres regardless of RLS. This route is the only path that can write
 * them, using the service-role client from lib/supabase/admin.ts.
 *
 * The admin's own identity is taken ONLY from the authenticated cookie
 * session (never from the request body) so no caller can forge
 * `assigned_by` as a different admin.
 */

const assignTeacherSchema = z.object({
  request_id: z.string().uuid(),
  teacher_id: z.string().uuid().optional(),
  action: z.enum(["assign", "decline"]),
}).refine((value) => value.action === "decline" || !!value.teacher_id, {
  message: "teacher_id is required to assign",
  path: ["teacher_id"],
})

interface AssignSuccessResponse {
  id: string
  status: string
}

interface AssignErrorResponse {
  error: string
}

export async function POST(
  request: Request
): Promise<NextResponse<AssignSuccessResponse | AssignErrorResponse>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Role is re-checked server-side against profiles — never trusted from the
  // client. A non-admin caller is rejected regardless of what the UI shows.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = assignTeacherSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }

  const { request_id, action } = parsed.data
  const adminClient = createAdminClient()

  if (action === "assign") {
    // Guaranteed present by the schema's refine() above, but narrowed
    // explicitly here so the branch below has a non-optional string.
    const teacher_id = parsed.data.teacher_id
    if (!teacher_id) {
      return NextResponse.json({ error: "teacher_id is required to assign" }, { status: 400 })
    }

    const { data: teacher } = await adminClient
      .from("teachers")
      .select("id, status")
      .eq("id", teacher_id)
      .maybeSingle()

    if (!teacher || teacher.status !== "approved") {
      return NextResponse.json({ error: "Only approved teachers can be assigned" }, { status: 400 })
    }

    // The .eq('status', 'open') guard is the double-assignment lock: two
    // admins racing to assign the same request will only have one UPDATE
    // affect a row (Postgres serializes concurrent UPDATEs on the same row,
    // and the second one's WHERE no longer matches once the first commits).
    const { data, error } = await adminClient
      .from("student_requests")
      .update({
        assigned_teacher_id: teacher_id,
        assigned_by: user.id,
        assigned_at: new Date().toISOString(),
        status: "assigned",
      })
      .eq("id", request_id)
      .eq("status", "open")
      .select("id, status, parent_id, subject")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "This request was already handled by another admin" },
        { status: 409 }
      )
    }

    // Tell both sides a match was made. Notification failures are swallowed by
    // the helpers themselves and deliberately not awaited into the response
    // contract: the assignment has already committed, so a notification
    // problem must never surface as a failed assignment to the admin.
    const assigned = data[0]
    await Promise.all([
      notifyTeacherByTeacherId({
        teacherId: teacher_id,
        type: "student_request_assigned",
        title: "New student assigned",
        message: `You have been assigned a student for ${assigned.subject}.`,
        actionUrl: "/teacher/students",
      }),
      notifyUser({
        userId: assigned.parent_id,
        type: "student_request_assigned",
        title: "Teacher assigned",
        message: `A teacher has been assigned for your ${assigned.subject} request.`,
        actionUrl: "/parent/requests",
      }),
    ])

    return NextResponse.json({ id: data[0].id, status: data[0].status })
  }

  const { data, error } = await adminClient
    .from("student_requests")
    .update({ status: "declined" })
    .eq("id", request_id)
    .eq("status", "open")
    .select("id, status, parent_id, subject")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "This request was already handled by another admin" },
      { status: 409 }
    )
  }

  await notifyUser({
    userId: data[0].parent_id,
    type: "student_request_assigned",
    title: "Request update",
    message: `Your ${data[0].subject} request could not be matched right now. Our team will follow up.`,
    actionUrl: "/parent/requests",
  })

  return NextResponse.json({ id: data[0].id, status: data[0].status })
}
