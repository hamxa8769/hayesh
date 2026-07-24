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
 *                        + endorsed state, for the admin panel.
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
 *   * POST 'verify' / 'unverify' — REAL, working. Toggles the "Hayesh
 *        Verified" badge (public.teachers.endorsed, added by migration 015)
 *        through the service-role client after the same admin check. Even
 *        though `endorsed` is a new column not covered by migration 001's
 *        column-level REVOKE (so a browser session could technically write
 *        it), this route still goes through the service-role client for
 *        consistency with every other privileged write here and to
 *        re-verify the admin role server-side rather than trust the client.
 *   * Testimonials (the admin-written editorial quotes that back "import
 *     testimonial") are a separate resource — see
 *     app/api/admin/testimonials/route.ts and public.testimonials
 *     (migration 015). This route never writes testimonial rows.
 */

const endorsementActionSchema = z.object({
  teacher_id: z.string().uuid("Invalid teacher id"),
  action: z.enum(["feature", "unfeature", "verify", "unverify"]),
})

interface TeacherEndorsementRow {
  id: string
  display_name: string
  status: string
  featured: boolean
  endorsed: boolean
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
    .select("id, display_name, status, featured, endorsed, average_rating, total_reviews")
    .eq("status", "approved")
    .order("display_name")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ teachers: (data ?? []) as TeacherEndorsementRow[] })
}

export async function POST(
  request: Request
): Promise<NextResponse<{ id: string; featured: boolean; endorsed: boolean } | EndorsementsErrorResponse>> {
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
  const adminClient = createAdminClient()

  const update =
    action === "feature" || action === "unfeature"
      ? { featured: action === "feature" }
      : { endorsed: action === "verify" }

  const { data, error } = await adminClient
    .from("teachers")
    .update(update)
    .eq("id", teacher_id)
    .eq("status", "approved")
    .select("id, featured, endorsed")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (!data) {
    return NextResponse.json({ error: "Teacher not found or not approved" }, { status: 404 })
  }

  const row = data as { id: string; featured: boolean; endorsed: boolean }
  return NextResponse.json({ id: row.id, featured: row.featured, endorsed: row.endorsed })
}
