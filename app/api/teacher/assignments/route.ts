import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { notifyUser } from "@/lib/notifications"
import { createAssignmentSchema } from "@/components/teacher/teaching-schema"

/**
 * POST /api/teacher/assignments — a teacher assigns homework to one of
 * their own students.
 *
 * This is a server route (not a direct client insert) for two reasons:
 *   1. It must verify the student is actually assigned to this teacher via
 *      public.student_requests before allowing the insert — the assignments
 *      RLS policy only checks `teacher_id in (select id from teachers where
 *      user_id = auth.uid())`, which stops a teacher writing rows under
 *      another teacher's identity but does NOT stop them targeting an
 *      arbitrary student_id under their own teacher_id. That extra check
 *      lives here.
 *   2. Notifying the student's parent (a DIFFERENT user) requires the
 *      service-role client in lib/notifications.ts — RLS on
 *      public.notifications only allows user_id = auth.uid().
 *
 * The insert itself still runs as the CALLER via the cookie-based client, so
 * migration 011's RLS + enforce_assignment_write_scope trigger remain the
 * real enforcement boundary; this route only adds the ownership check above
 * what RLS alone can express.
 */

interface CreateSuccessResponse {
  id: string
}

interface CreateErrorResponse {
  error: string
}

export async function POST(
  request: Request
): Promise<NextResponse<CreateSuccessResponse | CreateErrorResponse>> {
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
    return NextResponse.json({ error: "Only teachers can assign homework" }, { status: 403 })
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

  const parsed = createAssignmentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    )
  }

  const values = parsed.data

  // Verify the student is actually assigned to THIS teacher. A teacher must
  // never be able to set homework for an arbitrary child just by knowing
  // their student_id — the assignments RLS policy alone would not catch
  // that, since it only checks teacher_id ownership on the new row, not
  // whether the targeted student belongs to this teacher's roster.
  const { data: assignedRequest } = await supabase
    .from("student_requests")
    .select("id, students(id, parent_id, full_name)")
    .eq("student_id", values.student_id)
    .eq("assigned_teacher_id", teacherRow.id)
    .eq("status", "assigned")
    .maybeSingle()

  // PostgREST returns a single object for this many-to-one embed, but
  // supabase-js's inference widens it to an array. Normalise both: an array
  // would be truthy and slip past the guard below, leaving parent_id undefined
  // and silently skipping the parent's notification.
  type LinkedStudent = { id: string; parent_id: string; full_name: string }
  const rawStudents = (
    assignedRequest as unknown as { students: LinkedStudent | LinkedStudent[] | null } | null
  )?.students
  const linkedStudent: LinkedStudent | null = Array.isArray(rawStudents)
    ? (rawStudents[0] ?? null)
    : (rawStudents ?? null)

  if (!assignedRequest || !linkedStudent) {
    return NextResponse.json(
      { error: "This student is not assigned to you" },
      { status: 403 }
    )
  }

  const { data, error } = await supabase
    .from("assignments")
    .insert({
      teacher_id: teacherRow.id,
      student_id: values.student_id,
      title: values.title,
      instructions: values.instructions || null,
      subject: values.subject || null,
      due_date: values.due_date || null,
    })
    .select("id")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (!data) {
    return NextResponse.json({ error: "Assignment was not created" }, { status: 400 })
  }

  // Notification failure must never fail the request — the assignment has
  // already committed by this point.
  await notifyUser({
    userId: linkedStudent.parent_id,
    type: "assignment_created",
    title: "New homework assigned",
    message: `${teacherRow.display_name ?? "Your child's teacher"} assigned "${values.title}" to ${linkedStudent.full_name}.`,
    actionUrl: "/parent/progress",
  })

  return NextResponse.json({ id: (data as { id: string }).id })
}
