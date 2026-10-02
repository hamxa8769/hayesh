import { NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * POST /api/admin/gigs — approve or reject a seller's gig.
 *
 * Migration 001 revoked UPDATE on gigs.status from the `authenticated` role,
 * so approvals must go through the service-role client after the caller is
 * verified as an admin from the database.
 */
const gigDecisionSchema = z.object({
  gig_id: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
})

interface GigDecisionResponse {
  id: string
  status: string
}

export async function POST(request: Request): Promise<NextResponse<GigDecisionResponse | { error: string }>> {
  const auth = await requireUser(["admin"])
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = gigDecisionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }

  const { data, error } = await createAdminClient()
    .from("gigs")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.gig_id)
    .select("id, status")
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: "Gig not found" }, { status: 404 })
  return NextResponse.json({ id: data.id as string, status: data.status as string })
}
