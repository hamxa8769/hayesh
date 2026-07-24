import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * /api/admin/testimonials
 *
 * Admin-only CRUD for public.testimonials — editorial, admin-curated quotes
 * shown on teacher/seller profiles. These are explicitly SEPARATE from
 * public.teacher_reviews (the real parent-submitted reviews with rating +
 * average_rating rollups): a testimonial never touches teacher_reviews or
 * teachers.average_rating/total_reviews, and the public renderer
 * (components/teacher-public/TestimonialList.tsx) always labels them
 * "Testimonial" so they never get confused with real reviews.
 *
 * All writes go through the service-role client (createAdminClient()) after
 * requireAdmin() re-verifies profiles.role === 'admin' server-side — the
 * request body's claimed identity is never trusted, matching the pattern in
 * app/api/admin/ai-services/route.ts and app/api/admin/endorsements/route.ts.
 */

interface ErrorResponse {
  error: string
}

interface TestimonialRow {
  id: string
  subject_type: "teacher" | "seller"
  subject_id: string
  author_name: string
  author_role: string | null
  rating: number | null
  body: string
  source: "admin" | "imported"
  is_published: boolean
  created_by: string | null
  created_at: string | null
  updated_at: string | null
}

async function requireAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse<ErrorResponse> }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()

  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "Admin access required" }, { status: 403 }) }
  }

  return { ok: true, userId: user.id }
}

const baseTestimonialFields = {
  subject_type: z.enum(["teacher", "seller"]),
  subject_id: z.string().uuid("Invalid subject id"),
  author_name: z.string().trim().min(2, "Author name must be at least 2 characters").max(80),
  author_role: z
    .union([z.literal(""), z.string().trim().max(40)])
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  body: z.string().trim().min(5, "Testimonial body must be at least 5 characters").max(1000),
  source: z.enum(["admin", "imported"]).default("admin"),
  is_published: z.boolean().default(true),
}

const createSchema = z.object(baseTestimonialFields)

const patchSchema = z
  .object({ id: z.string().uuid("Invalid testimonial id") })
  .and(z.object(baseTestimonialFields).partial())

function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid request"
}

export async function GET(
  request: Request
): Promise<NextResponse<{ testimonials: TestimonialRow[] } | ErrorResponse>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const subjectType = url.searchParams.get("subject_type")
  const subjectId = url.searchParams.get("subject_id")

  const adminClient = createAdminClient()
  let query = adminClient.from("testimonials").select("*").order("created_at", { ascending: false })

  if (subjectType === "teacher" || subjectType === "seller") {
    query = query.eq("subject_type", subjectType)
  }
  if (subjectId) {
    query = query.eq("subject_id", subjectId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ testimonials: (data ?? []) as TestimonialRow[] })
}

export async function POST(
  request: Request
): Promise<NextResponse<{ testimonial: TestimonialRow } | ErrorResponse>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from("testimonials")
    .insert({ ...parsed.data, created_by: auth.userId })
    .select("*")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (!data) {
    return NextResponse.json({ error: "Failed to create testimonial" }, { status: 500 })
  }

  return NextResponse.json({ testimonial: data as TestimonialRow }, { status: 201 })
}

export async function PATCH(
  request: Request
): Promise<NextResponse<{ testimonial: TestimonialRow } | ErrorResponse>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 })
  }

  const { id, ...fields } = parsed.data
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from("testimonials")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (!data) {
    return NextResponse.json({ error: "Testimonial not found" }, { status: 404 })
  }

  return NextResponse.json({ testimonial: data as TestimonialRow })
}

export async function DELETE(request: Request): Promise<NextResponse<{ success: true } | ErrorResponse>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const id = url.searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient.from("testimonials").delete().eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
