import { NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { notifyUser } from "@/lib/notifications"
import { rateLimit } from "@/lib/security/rate-limit"
import type { GigReview } from "@/types/database"

const postSchema = z.object({
  gig_order_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).default(""),
})

const getSchema = z.object({ gig_id: z.string().uuid() })

export interface PublicGigReview {
  id: string
  reviewer_name: string
  rating: number
  comment: string | null
  seller_reply: string | null
  seller_replied_at: string | null
  created_at: string | null
}

export interface GigReviewsResponse {
  enabled: boolean
  reviews: PublicGigReview[]
  summary: { average: number; count: number; distribution: Record<1 | 2 | 3 | 4 | 5, number> }
}

type ErrorBody = { error: string }

function emptyDistribution(): Record<1 | 2 | 3 | 4 | 5, number> {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
}

/** "Amina Khan" -> "Amina K."; single names are kept as-is. */
function shortName(fullName: string | null | undefined): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "Buyer"
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`
}

function settingIsTrue(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "string") return value === "true"
  return fallback
}

export async function GET(request: Request): Promise<NextResponse<GigReviewsResponse | ErrorBody>> {
  const parsed = getSchema.safeParse({ gig_id: new URL(request.url).searchParams.get("gig_id") })
  if (!parsed.success) return NextResponse.json({ error: "gig_id is required" }, { status: 400 })
  const gigId = parsed.data.gig_id

  const admin = createAdminClient()
  const { data: setting } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", "gig_reviews_enabled")
    .maybeSingle()
  if (!settingIsTrue(setting?.value, true)) {
    return NextResponse.json({
      enabled: false,
      reviews: [],
      summary: { average: 0, count: 0, distribution: emptyDistribution() },
    })
  }

  const [list, ratings] = await Promise.all([
    admin
      .from("gig_reviews")
      .select("id, reviewer_name, rating, comment, seller_reply, seller_replied_at, created_at")
      .eq("gig_id", gigId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(50),
    admin.from("gig_reviews").select("rating").eq("gig_id", gigId).eq("status", "published"),
  ])
  if (list.error || ratings.error) {
    return NextResponse.json({ error: "Could not load reviews" }, { status: 500 })
  }

  const distribution = emptyDistribution()
  let total = 0
  for (const r of ratings.data ?? []) {
    const n = r.rating as 1 | 2 | 3 | 4 | 5
    if (n >= 1 && n <= 5) {
      distribution[n] += 1
      total += n
    }
  }
  const count = (ratings.data ?? []).length
  const average = count > 0 ? Math.round((total / count) * 100) / 100 : 0

  return NextResponse.json({
    enabled: true,
    reviews: (list.data ?? []) as PublicGigReview[],
    summary: { average, count, distribution },
  })
}

export async function POST(request: Request): Promise<NextResponse<{ review: GigReview } | ErrorBody>> {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { userId } = auth.user

  const limit = rateLimit(`gig-review:${userId}`, 10, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${limit.retryAfterSeconds}s` },
      { status: 429 },
    )
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const parsed = postSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a rating from 1 to 5 (comment up to 2000 characters)" }, { status: 400 })
  }
  const { gig_order_id, rating, comment } = parsed.data

  const admin = createAdminClient()
  const { data: order } = await admin
    .from("gig_orders")
    .select("id, gig_id, seller_id, buyer_id, status, gig_title")
    .eq("id", gig_order_id)
    .maybeSingle()
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
  if (order.buyer_id !== userId) {
    return NextResponse.json({ error: "Only the buyer can review this order" }, { status: 403 })
  }
  if (order.status !== "completed") {
    return NextResponse.json({ error: "You can review an order once it is completed" }, { status: 400 })
  }

  const { data: existing } = await admin.from("gig_reviews").select("id").eq("gig_order_id", gig_order_id).maybeSingle()
  if (existing) return NextResponse.json({ error: "You have already reviewed this order" }, { status: 409 })

  const { data: moderation } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", "gig_reviews_moderation")
    .maybeSingle()
  const status = settingIsTrue(moderation?.value, false) ? "pending" : "published"

  const { data: created, error } = await admin
    .from("gig_reviews")
    .insert({
      gig_order_id,
      gig_id: order.gig_id,
      seller_id: order.seller_id,
      buyer_id: userId,
      reviewer_name: shortName(auth.user.fullName),
      rating,
      comment: comment.length > 0 ? comment : null,
      status,
    })
    .select("*")
    .single()

  if (error || !created) {
    // Unique violation = lost a double-submit race.
    if (error?.code === "23505") {
      return NextResponse.json({ error: "You have already reviewed this order" }, { status: 409 })
    }
    console.error("[gig-reviews] insert failed", error?.message)
    return NextResponse.json({ error: "Could not save your review" }, { status: 500 })
  }

  const { data: seller } = await admin.from("sellers").select("user_id").eq("id", order.seller_id).maybeSingle()
  if (seller?.user_id) {
    await notifyUser({
      userId: seller.user_id as string,
      type: "review_received",
      title: "New review received",
      message: `${shortName(auth.user.fullName)} left a ${rating}-star review on "${order.gig_title ?? "your gig"}".`,
      actionUrl: "/seller/orders",
    })
  }

  return NextResponse.json({ review: created as GigReview })
}
