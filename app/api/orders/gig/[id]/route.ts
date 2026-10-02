import { NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { notifyAdmins, notifyUser } from "@/lib/notifications"
import { completeGigOrder } from "@/lib/payments/gig-orders"
import type { GigOrder } from "@/types/database"

/**
 * POST /api/orders/gig/[id] — gig order lifecycle.
 *
 *   deliver   (seller)        in_progress | revision_requested → delivered
 *   accept    (buyer)         delivered → completed, escrow released to seller
 *   revision  (buyer)         delivered → revision_requested (within allowance)
 *   dispute   (buyer|seller)  in_progress | delivered | revision_requested → disputed
 *
 * Every transition is a conditional update on the current status.
 */

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("deliver"),
    message: z.string().trim().min(5, "Add a short delivery note").max(5000),
    files: z.array(z.string().url().max(1000)).max(10).default([]),
  }),
  z.object({ action: z.literal("accept") }),
  z.object({ action: z.literal("revision"), message: z.string().trim().min(5, "Tell the seller what to change").max(3000) }),
  z.object({ action: z.literal("dispute"), reason: z.string().trim().min(10, "Describe the problem (at least 10 characters)").max(3000) }),
])

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid order id" }, { status: 400 })

  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { user } = auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })

  const admin = createAdminClient()
  const { data: orderData } = await admin.from("gig_orders").select("*").eq("id", id).maybeSingle()
  const order = orderData as GigOrder | null
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

  const { data: seller } = await admin.from("sellers").select("user_id").eq("id", order.seller_id).maybeSingle()
  const sellerUserId = (seller as { user_id: string } | null)?.user_id ?? null
  const isBuyer = order.buyer_id === user.userId
  const isSeller = sellerUserId === user.userId
  if (!isBuyer && !isSeller) return NextResponse.json({ error: "This is not your order" }, { status: 403 })

  const now = new Date().toISOString()
  const title = order.gig_title ?? "your order"
  const input = parsed.data

  const transition = async (from: string[], patch: Record<string, unknown>): Promise<boolean> => {
    const { data } = await admin
      .from("gig_orders")
      .update({ ...patch, updated_at: now })
      .eq("id", id)
      .in("status", from)
      .select("id")
    return (data?.length ?? 0) > 0
  }

  switch (input.action) {
    case "deliver": {
      if (!isSeller) return NextResponse.json({ error: "Only the seller can deliver" }, { status: 403 })
      const ok = await transition(["in_progress", "revision_requested"], {
        status: "delivered",
        delivered_at: now,
        delivery_message: input.message,
        delivery_files: input.files,
      })
      if (!ok) return NextResponse.json({ error: "This order can't be delivered right now" }, { status: 409 })
      await notifyUser({
        userId: order.buyer_id,
        type: "order_delivered",
        title: "Your order was delivered",
        message: `The seller delivered "${title}". Review it and accept, or request a revision.`,
        actionUrl: "/buyer/orders",
      })
      break
    }
    case "accept": {
      if (!isBuyer) return NextResponse.json({ error: "Only the buyer can accept a delivery" }, { status: 403 })
      const ok = await completeGigOrder(id, sellerUserId)
      if (!ok) return NextResponse.json({ error: "Only a delivered order can be accepted" }, { status: 409 })
      break
    }
    case "revision": {
      if (!isBuyer) return NextResponse.json({ error: "Only the buyer can request a revision" }, { status: 403 })
      const used = order.revisions_used ?? 0
      const allowed = order.revisions_allowed ?? 0
      if (used >= allowed) {
        return NextResponse.json({ error: "You've used all revisions included in this package" }, { status: 409 })
      }
      const ok = await transition(["delivered"], { status: "revision_requested", revisions_used: used + 1 })
      if (!ok) return NextResponse.json({ error: "Revisions can only be requested on a delivered order" }, { status: 409 })
      if (sellerUserId) {
        await notifyUser({
          userId: sellerUserId,
          type: "order_revision",
          title: "Revision requested",
          message: `Buyer requested changes on "${title}": ${input.message.slice(0, 300)}`,
          actionUrl: "/seller/orders",
        })
      }
      break
    }
    case "dispute": {
      const ok = await transition(["in_progress", "delivered", "revision_requested"], {
        status: "disputed",
        dispute_opened_at: now,
        dispute_reason: `${isBuyer ? "Buyer" : "Seller"}: ${input.reason}`,
      })
      if (!ok) return NextResponse.json({ error: "This order can't be disputed" }, { status: 409 })
      await notifyAdmins({
        type: "order_disputed",
        title: "Order disputed",
        message: `"${title}" was disputed by the ${isBuyer ? "buyer" : "seller"}. Funds stay in escrow until resolved.`,
        actionUrl: "/admin/disputes",
      })
      const other = isBuyer ? sellerUserId : order.buyer_id
      if (other) {
        await notifyUser({
          userId: other,
          type: "order_disputed",
          title: "Order under review",
          message: `"${title}" is under dispute review by Hayesh. We'll be in touch.`,
          actionUrl: isBuyer ? "/seller/orders" : "/buyer/orders",
        })
      }
      break
    }
  }

  return NextResponse.json({ ok: true })
}
