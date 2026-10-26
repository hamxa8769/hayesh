import { NextResponse } from "next/server"
import { z } from "zod"
import { logAdminAction } from "@/lib/admin/audit"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * PATCH /api/admin/teachers/[id]/recording-retention
 * Body: { days: 30 | 90 | null } — null falls back to the platform default.
 * [id] is teachers.id. Admin-only; written with the service-role client.
 */

const bodySchema = z.object({
  days: z.union([z.literal(30), z.literal(90), z.null()]),
})

interface RetentionResponse {
  ok?: true
  days?: number | null
  error?: string
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse<RetentionResponse>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid teacher id" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "days must be 30, 90 or null" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: existing, error: readError } = await admin
    .from("teachers")
    .select("id, recording_retention_days")
    .eq("id", id)
    .maybeSingle()
  if (readError) return NextResponse.json({ error: readError.message }, { status: 400 })
  if (!existing) return NextResponse.json({ error: "Teacher not found" }, { status: 404 })

  const { error } = await admin
    .from("teachers")
    .update({ recording_retention_days: parsed.data.days })
    .eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logAdminAction({
    actorId: user.id,
    action: "teacher.recording_retention",
    targetTable: "teachers",
    targetId: id,
    before: { recording_retention_days: (existing as { recording_retention_days?: number | null }).recording_retention_days ?? null },
    after: { recording_retention_days: parsed.data.days },
    request,
  })

  return NextResponse.json({ ok: true, days: parsed.data.days })
}
