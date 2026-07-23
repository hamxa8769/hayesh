import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { notifyUser } from "@/lib/notifications"

/**
 * POST /api/teacher/assignments/reopen — a teacher sends a graded or
 * already-submitted piece of homework back to the student for another
 * pass, by resetting `status` to 'assigned'.
 *
 * This is a server route (not a direct client update) for the same reason
 * app/api/teacher/assignments/route.ts is: notifying the student's PARENT
 * (a different user than the caller) requires the service-role client in
 * lib/notifications.ts, since RLS on public.notifications only allows
 * user_id = auth.uid().
 *
 * The update itself still runs as the CALLER via the cookie-based client.
 * Migration 011's "Teacher manages own assignments" RLS policy plus the
 * enforce_assignment_write_scope BEFORE UPDATE trigger
 * (supabase-migrations/011-learning-scheduling-payments.sql) already let
 * the assigning teacher change `status` freely on rows where
 * teacher_id = their own teachers.id — the explicit
 * .eq("teacher_id", teacherRow.id) below is an extra belt-and-suspenders
 * scope, not a workaround for a gap in that trigger.
 *
 * grade/feedback are intentionally left untouched: the student and parent
 * keep seeing the prior grade/feedback as context while the resubmission
 * is prepared, exactly as the task asked for.
 */

const reopenAssignmentSchema = z.object({
  assignment_id: z.string().uuid("Invalid assignment id"),
})

interface ReopenSuccessResponse {
  id: string
  status: "assigned"
}

interface ReopenErrorResponse {
  error: string
}

export async function POST(
  request: Request
): Promise<NextResponse<ReopenSuccessResponse | ReopenErrorResponse>> {
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
    return NextResponse.json({ error: "Only teachers can reopen homework" }, { status: 403 })
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

  const parsed = reopenAssignmentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    )
  }

  const { assignment_id } = parsed.data

  const { data, error } = await supabase
    .from("assignments")
    .update({ status: "assigned" })
    .eq("id", assignment_id)
    .eq("teacher_id", teacherRow.id)
    .in("status", ["submitted", "graded"])
    .select("id, title, student_id, students(parent_id, full_name)")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (!data) {
    return NextResponse.json(
      { error: "Assignment not found, not yours, or not currently submitted/graded" },
      { status: 404 }
    )
  }

  // PostgREST returns a single object for this many-to-one embed, but
  // supabase-js's inference widens it to an array — mirrors the same
  // normalisation used in app/api/teacher/assignments/route.ts.
  type LinkedStudent = { parent_id: string; full_name: string }
  const rawStudent = (
    data as unknown as { students: LinkedStudent | LinkedStudent[] | null }
  ).students
  const linkedStudent: LinkedStudent | null = Array.isArray(rawStudent)
    ? (rawStudent[0] ?? null)
    : (rawStudent ?? null)

  // Notification failure must never fail the request — the reopen has
  // already committed by this point.
  if (linkedStudent) {
    await notifyUser({
      userId: linkedStudent.parent_id,
      type: "assignment_created",
      title: "Homework reopened",
      message: `${teacherRow.display_name ?? "Your child's teacher"} reopened "${(data as { title: string }).title}" for ${linkedStudent.full_name} to edit and resubmit.`,
      actionUrl: "/parent/progress",
    })
  }

  return NextResponse.json({ id: (data as { id: string }).id, status: "assigned" })
}
