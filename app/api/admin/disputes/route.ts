import { NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { notifyUser } from "@/lib/notifications"
import { completeGigOrder } from "@/lib/payments/gig-orders"
import { refundGigEscrow } from "@/lib/payments/settle"
import type { GigOrder } from "@/types/database"

/**
 * /api/admin/disputes
 *   GET  → disputed gig orders with buyer + seller names
 *   POST → { order_id, resolution: 'release' | 'refund', note }
 *          release: seller is paid (order completed, escrow released)
 *          refund:  order cancelled, escrow marked refunded — admin returns
 *                   the money to the buyer through the original channel.
 */

export interface DisputeItem extends GigOrder {
  buyer_name: string | null
  seller_name: string | null
}

export async function GET() {
  const auth = await requireUser(["admin"])
  if (!auth.ok) return auth.response

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("gig_orders")
    .select("*")
    .eq("status", "disputed")
    .order("dispute_opened_at", { ascending: true })
    .limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const orders = (data ?? []) as GigOrder[]
  const buyerIds = Array.from(new Set(orders.map((o) => o.buyer_id)))
  const sellerIds = Array.from(new Set(orders.map((o) => o.seller_id)))
  const [{ data: buyers }, { data: sellers }] = await Promise.all([
    buyerIds.length ? admin.from("profiles").select("id, full_name").in("id", buyerIds) : Promise.resolve({ data: [] }),
    sellerIds.length ? admin.from("sellers").select("id, display_name").in("id", sellerIds) : Promise.resolve({ data: [] }),
  ])
  const buyerMap = new Map((buyers ?? []).map((b: { id: string; full_name: string }) => [b.id, b.full_name]))
  const sellerMap = new Map((sellers ?? []).map((s: { id: string; display_name: string }) => [s.id, s.display_name]))

  const items: DisputeItem[] = orders.map((o) => ({
    ...o,
    buyer_name: buyerMap.get(o.buyer_id) ?? null,
    seller_name: sellerMap.get(o.seller_id) ?? null,
  }))
  return NextResponse.json({ items })
}

const resolveSchema = z.object({
  order_id: z.string().uuid(),
  resolution: z.enum(["release", "refund"]),
  note: z.string().trim().min(3, "Add a resolution note").max(2000),
})

export async function POST(request: Request) {
  const auth = await requireUser(["admin"])
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = resolveSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })

  const { order_id: orderId, resolution, note } = parsed.data
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: orderData } = await admin.from("gig_orders").select("*").eq("id", orderId).maybeSingle()
  const order = orderData as GigOrder | null
  if (!order || order.status !== "disputed") return NextResponse.json({ error: "This order is not in dispute" }, { status: 409 })

  await admin.from("gig_orders").update({ dispute_resolved_at: now, dispute_resolution: `${resolution}: ${note}` }).eq("id", orderId)

  if (resolution === "release") {
    const ok = await completeGigOrder(orderId, null, ["disputed"])
    if (!ok) return NextResponse.json({ error: "Could not release this order" }, { status: 409 })
  } else {
    const { data } = await admin
      .from("gig_orders")
      .update({ status: "cancelled", updated_at: now })
      .eq("id", orderId)
      .eq("status", "disputed")
      .select("id")
    if (!data?.length) return NextResponse.json({ error: "Could not refund this order" }, { status: 409 })
    await refundGigEscrow(orderId)
  }

  await notifyUser({
    userId: order.buyer_id,
    type: "dispute_resolved",
    title: "Dispute resolved",
    message: `"${order.gig_title ?? "Your order"}": ${resolution === "refund" ? "refund approved" : "resolved in the seller's favour"}. ${note}`,
    actionUrl: "/buyer/orders",
  })
  return NextResponse.json({ ok: true })
}
