import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { notifyAdmins } from "@/lib/notifications"

/**
 * POST /api/student-requests — a parent asks for a teacher for one of their
 * children.
 *
 * This exists as a server route purely so admins actually find out. The insert
 * itself is something the browser could do (migration 010 grants the parent
 * INSERT on exactly these columns), but notifying admins requires writing
 * notification rows for OTHER users, which RLS correctly forbids from the
 * client and which lib/notifications.ts only does with the service-role client.
 * Before this route, a parent could submit a request and it would sit in the
 * table with nothing anywhere telling an admin it had arrived.
 *
 * The insert still runs as the CALLER via the cookie-based client, not the
 * service role, so migration 010's RLS policy and column grants remain the
 * enforcement boundary — this route does not widen what a parent may write.
 */

const studentRequestSchema = z.object({
  student_id: z.string().uuid(),
  subject: z.string().trim().min(1, "Subject is required").max(120),
  preferred_tier: z.enum(["group", "standard", "private"]),
  notes: z.string().trim().max(500).optional(),
})

interface CreateSuccessResponse {
  id: string
}

interface CreateErrorResponse {
  error: string
}

export async function POST(
  request: Request,
): Promise<NextResponse<CreateSuccessResponse | CreateErrorResponse>> {
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

  const parsed = studentRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    )
  }

  const values = parsed.data

  // parent_id always comes from the session, never the body, so nobody can
  // file a request on another parent's behalf. RLS would reject it anyway,
  // but not sending it at all is the clearer contract.
  const { data, error } = await supabase
    .from("student_requests")
    .insert({
      student_id: values.student_id,
      parent_id: user.id,
      subject: values.subject,
      preferred_tier: values.preferred_tier,
      notes: values.notes || null,
    })
    .select("id")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (!data) {
    return NextResponse.json({ error: "Request was not created" }, { status: 400 })
  }

  // The whole reason this route exists. notifyAdmins fans out in a single
  // batched insert and never throws — the request has already committed, so a
  // notification failure must not be reported to the parent as a failed
  // submission.
  await notifyAdmins({
    type: "student_request_created",
    title: "New teacher request",
    message: `A parent requested a teacher for ${values.subject}.`,
    actionUrl: "/admin/requests",
  })

  return NextResponse.json({ id: data.id })
}
