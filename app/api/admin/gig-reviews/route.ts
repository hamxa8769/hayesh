import { NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import type { GigReview } from "@/types/database"

export interface AdminGigReview extends GigReview {
  gig_title: string
  seller_name: string
}

export interface AdminGigReviewsResponse {
  items: AdminGigReview[]
  counts: { all: number; pending: number; published: number; hidden: number }
}

type ErrorBody = { error: string }

const statusSchema = z.enum(["all", "pending", "published", "hidden"])
const postSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["publish", "hide", "delete"]),
})

export async function GET(request: Request): Promise<NextResponse<AdminGigReviewsResponse | ErrorBody>> {
  const auth = await requireUser(["admin"])
  if (!auth.ok) return auth.response

  const parsedStatus = statusSchema.safeParse(new URL(request.url).searchParams.get("status") ?? "all")
  if (!parsedStatus.success) return NextResponse.json({ error: "Invalid status filter" }, { status: 400 })
  const status = parsedStatus.data

  const admin = createAdminClient()
  let query = admin.from("gig_reviews").select("*").order("created_at", { ascending: false }).limit(200)
  if (status !== "all") query = query.eq("status", status)

  const [list, statuses] = await Promise.all([query, admin.from("gig_reviews").select("status")])
  if (list.error || statuses.error) return NextResponse.json({ error: "Could not load reviews" }, { status: 500 })

  const rows = (list.data ?? []) as GigReview[]
  const gigIds = Array.from(new Set(rows.map((r) => r.gig_id)))
  const sellerIds = Array.from(new Set(rows.map((r) => r.seller_id)))
  const [gigs, sellers] = await Promise.all([
    gigIds.length ? admin.from("gigs").select("id, title").in("id", gigIds) : Promise.resolve({ data: [] }),
    sellerIds.length ? admin.from("sellers").select("id, display_name").in("id", sellerIds) : Promise.resolve({ data: [] }),
  ])
  const gigTitle = new Map((gigs.data ?? []).map((g) => [g.id as string, g.title as string]))
  const sellerName = new Map((sellers.data ?? []).map((s) => [s.id as string, s.display_name as string]))

  const counts = { all: 0, pending: 0, published: 0, hidden: 0 }
  for (const s of statuses.data ?? []) {
    counts.all += 1
    const key = s.status as "pending" | "published" | "hidden"
    if (key in counts) counts[key] += 1
  }

  return NextResponse.json({
    items: rows.map((r) => ({
      ...r,
      gig_title: gigTitle.get(r.gig_id) ?? "Gig",
      seller_name: sellerName.get(r.seller_id) ?? "Seller",
    })),
    counts,
  })
}

export async function POST(request: Request): Promise<NextResponse<{ ok: true } | ErrorBody>> {
  const auth = await requireUser(["admin"])
  if (!auth.ok) return auth.response

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const parsed = postSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  const { id, action } = parsed.data

  const admin = createAdminClient()
  const { data: existing } = await admin.from("gig_reviews").select("id").eq("id", id).maybeSingle()
  if (!existing) return NextResponse.json({ error: "Review not found" }, { status: 404 })

  const { error } =
    action === "delete"
      ? await admin.from("gig_reviews").delete().eq("id", id)
      : await admin
          .from("gig_reviews")
          .update({ status: action === "publish" ? "published" : "hidden", updated_at: new Date().toISOString() })
          .eq("id", id)
  if (error) {
    console.error("[admin/gig-reviews] action failed", error.message)
    return NextResponse.json({ error: "Could not update the review" }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
