import { createAdminClient } from "@/lib/supabase/admin"
import { notifyUser } from "@/lib/notifications"
import { releaseGigEscrow } from "@/lib/payments/settle"

if (typeof window !== "undefined") {
  throw new Error("lib/payments/gig-orders.ts must never be imported client-side")
}

/**
 * Completes a delivered gig order and releases its escrow to the seller.
 * Used by buyer "accept", the auto-complete cron, and admin dispute
 * resolution (which passes allowFrom = ['disputed']).
 */
export async function completeGigOrder(
  orderId: string,
  sellerUserId: string | null,
  allowFrom: string[] = ["delivered"]
): Promise<boolean> {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data } = await admin
    .from("gig_orders")
    .update({ status: "completed", accepted_at: now, updated_at: now })
    .eq("id", orderId)
    .in("status", allowFrom)
    .select("id, seller_id, gig_title, buyer_id")
  const row = (data ?? [])[0] as { id: string; seller_id: string; gig_title: string | null; buyer_id: string } | undefined
  if (!row) return false

  await releaseGigEscrow(orderId)

  const { data: seller } = await admin.from("sellers").select("completed_orders, user_id").eq("id", row.seller_id).maybeSingle()
  if (seller) {
    await admin.from("sellers").update({ completed_orders: Number(seller.completed_orders ?? 0) + 1 }).eq("id", row.seller_id)
  }
  const recipient = sellerUserId ?? (seller as { user_id: string } | null)?.user_id ?? null
  if (recipient) {
    await notifyUser({
      userId: recipient,
      type: "order_completed",
      title: "Order completed — funds released",
      message: `"${row.gig_title ?? "Your order"}" is complete. Your earnings are now available to withdraw.`,
      actionUrl: "/seller/earnings",
    })
  }
  return true
}
