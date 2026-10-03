import { NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { notifyUser } from "@/lib/notifications"
import { rateLimit } from "@/lib/security/rate-limit"
import type { GigReview } from "@/types/database"

const bodySchema = z.object({ reply: z.string().trim().min(1).max(1000) })
const idSchema = z.string().uuid()

type ErrorBody = { error: string }

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<{ review: GigReview } | ErrorBody>> {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { userId } = auth.user

  const { id } = await params
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Review not found" }, { status: 404 })

  const limit = rateLimit(`gig-review-reply:${userId}`, 20, 60_000)
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
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: "Reply must be 1–1000 characters" }, { status: 400 })

  const admin = createAdminClient()
  const { data: review } = await admin
    .from("gig_reviews")
    .select("id, seller_id, buyer_id, status, gig_id")
    .eq("id", id)
    .maybeSingle()
  if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 })

  const { data: seller } = await admin.from("sellers").select("user_id").eq("id", review.seller_id).maybeSingle()
  if (!seller || seller.user_id !== userId) {
    return NextResponse.json({ error: "Only the seller can reply to this review" }, { status: 403 })
  }
  if (review.status === "hidden") {
    return NextResponse.json({ error: "This review is not available" }, { status: 400 })
  }

  const { data: updated, error } = await admin
    .from("gig_reviews")
    .update({
      seller_reply: parsed.data.reply,
      seller_replied_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single()
  if (error || !updated) {
    console.error("[gig-reviews] reply failed", error?.message)
    return NextResponse.json({ error: "Could not save your reply" }, { status: 500 })
  }

  await notifyUser({
    userId: review.buyer_id as string,
    type: "review_reply",
    title: "The seller replied to your review",
    message: parsed.data.reply.slice(0, 140),
    actionUrl: `/marketplace/${review.gig_id as string}`,
  })

  return NextResponse.json({ review: updated as GigReview })
}
