import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * /api/admin/endorsements
 *
 * Admin controls for boosting a teacher's visibility WITHOUT fabricating
 * social proof. The owner originally asked for admin-written reviews to
 * inflate ratings — we do not do that. What ships here:
 *
 *   * GET             — list approved teachers with their current featured
 *                        state, for the admin panel.
 *   * POST 'feature' / 'unfeature' — REAL, working. Toggles
 *                        public.teachers.featured through the service-role
 *                        client, because migration 001
 *                        (supabase-migrations/001-protect-privileged-columns.sql)
 *                        revoked UPDATE on `teachers.status`/`teachers.featured`
 *                        from the `authenticated` Postgres role entirely — a
 *                        browser-session write to that column is rejected
 *                        regardless of RLS, so this must go through
 *                        lib/supabase/admin.ts after verifying the caller is
 *                        an admin here.
 *   * POST 'grant_verified_badge' / 'import_testimonial' — NOT implemented.
 *        public.teachers has no `endorsed`/`verified` column, and
 *        public.teacher_reviews has no column to attribute a review to an
 *        imported source or flag it verified (see supabase-schema.sql:
 *        teacher_reviews only has id/teacher_id/reviewer_id/rating/comment/
 *        created_at, and reviewer_id is a NOT NULL FK to profiles — writing
 *        a review under the admin's own id would misattribute it as the
 *        admin's opinion, not a real parent's). Inserting a review here
 *        would be fabricating a testimonial, which this task explicitly
 *        forbids. These actions return 400 with a clear "needs a schema
 *        change" message instead of silently no-op'ing or faking data.
 *        The migration that would unblock them: add
 *        `teachers.endorsed boolean` for the verified badge, and a new
 *        `public.testimonials` table (teacher_id, author_name, author_role,
 *        source_url, verified boolean, imported_by, created_at) for
 *        attributed real-testimonial imports.
 */

const NOT_YET_SUPPORTED = new Set(["grant_verified_badge", "import_testimonial"])

const endorsementActionSchema = z.object({
  teacher_id: z.string().uuid("Invalid teacher id"),
  action: z.enum(["feature", "unfeature", "grant_verified_badge", "import_testimonial"]),
})

interface TeacherEndorsementRow {
  id: string
  display_name: string
  status: string
  featured: boolean
  average_rating: number
  total_reviews: number
}

interface EndorsementsErrorResponse {
  error: string
}

async function requireAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse<EndorsementsErrorResponse> }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "Admin access required" }, { status: 403 }) }
  }

  return { ok: true, userId: user.id }
}

export async function GET(): Promise<
  NextResponse<{ teachers: TeacherEndorsementRow[] } | EndorsementsErrorResponse>
> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from("teachers")
    .select("id, display_name, status, featured, average_rating, total_reviews")
    .eq("status", "approved")
    .order("display_name")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ teachers: (data ?? []) as TeacherEndorsementRow[] })
}

export async function POST(
  request: Request
): Promise<NextResponse<{ id: string; featured: boolean } | EndorsementsErrorResponse>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = endorsementActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    )
  }

  const { teacher_id, action } = parsed.data

  if (NOT_YET_SUPPORTED.has(action)) {
    return NextResponse.json(
      {
        error:
          action === "grant_verified_badge"
            ? "The Hayesh Verified badge needs a schema change (a teachers.endorsed column) before it can be granted. Not implemented yet."
            : "Importing a testimonial needs a schema change (a testimonials table with an attributed author and verified flag) before it can be done honestly. Not implemented yet.",
      },
      { status: 400 }
    )
  }

  const adminClient = createAdminClient()
  const nextFeatured = action === "feature"

  const { data, error } = await adminClient
    .from("teachers")
    .update({ featured: nextFeatured })
    .eq("id", teacher_id)
    .eq("status", "approved")
    .select("id, featured")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (!data) {
    return NextResponse.json({ error: "Teacher not found or not approved" }, { status: 404 })
  }

  return NextResponse.json({ id: (data as { id: string }).id, featured: (data as { featured: boolean }).featured })
}
