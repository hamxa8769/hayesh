import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCommerceSettings } from "@/lib/payments/settings"
import { createRenewalTransaction } from "@/lib/payments/checkout"
import { completeGigOrder } from "@/lib/payments/gig-orders"
import { notifyUser } from "@/lib/notifications"
import { reconcilePaidOrders } from "@/lib/payments/settle"

/**
 * GET /api/cron/commerce — daily housekeeping (scheduled in vercel.json).
 *
 *  0. Reconcile paid orders whose activation was interrupted.
 *  1. Auto-complete gig orders delivered more than N days ago (buyer silent).
 *  2. Issue next-month tuition charges 3 days before a period ends.
 *  3. Mark subscriptions past_due once their period has ended unpaid.
 *  4. Expire checkout transactions left unpaid (no proof) for 7 days.
 *
 * Protected by CRON_SECRET (Vercel sends it as a Bearer token).
 */

export const maxDuration = 60

const DAY_MS = 24 * 60 * 60 * 1000
const RENEWAL_LEAD_DAYS = 3
const ABANDONED_CHECKOUT_DAYS = 7

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const expected = Buffer.from(`Bearer ${secret ?? ""}`)
  const given = Buffer.from(request.headers.get("authorization") ?? "")
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const settings = await getCommerceSettings()
  const now = Date.now()
  const summary = { reconciled: 0, autoCompleted: 0, renewalsIssued: 0, pastDue: 0, expired: 0 }

  // 0. Finish any payment whose activation was interrupted.
  summary.reconciled = await reconcilePaidOrders()

  // 1. Auto-complete stale deliveries.
  const deliveredBefore = new Date(now - settings.gigAutoCompleteDays * DAY_MS).toISOString()
  const { data: stale } = await admin.from("gig_orders").select("id").eq("status", "delivered").lt("delivered_at", deliveredBefore).limit(200)
  for (const row of (stale ?? []) as Array<{ id: string }>) {
    if (await completeGigOrder(row.id, null)) summary.autoCompleted++
  }

  // 2. Renewal charges for periods ending soon.
  const renewBy = new Date(now + RENEWAL_LEAD_DAYS * DAY_MS).toISOString()
  const { data: due } = await admin
    .from("subscriptions")
    .select("id, parent_id, child_name, subject, current_period_end")
    .eq("status", "active")
    .lt("current_period_end", renewBy)
    .limit(500)
  for (const sub of (due ?? []) as Array<{ id: string; parent_id: string; child_name: string; subject: string; current_period_end: string }>) {
    const { data: existing } = await admin.from("transactions").select("id").eq("subscription_id", sub.id).eq("status", "pending").limit(1)
    if (existing && existing.length > 0) continue
    const result = await createRenewalTransaction(sub.id)
    if (result.ok && result.transactionId) {
      summary.renewalsIssued++
      await notifyUser({
        userId: sub.parent_id,
        type: "subscription_renewal_due",
        title: "Tuition renewal due",
        message: `${sub.child_name}'s ${sub.subject} tuition renews on ${new Date(sub.current_period_end).toDateString()}. Pay now to keep lessons going.`,
        actionUrl: `/checkout/${result.transactionId}`,
      })
    }
  }

  // 3. Lapsed subscriptions.
  const { data: lapsed } = await admin
    .from("subscriptions")
    .update({ status: "past_due", updated_at: new Date(now).toISOString() })
    .eq("status", "active")
    .lt("current_period_end", new Date(now).toISOString())
    .select("id, parent_id, child_name")
  for (const sub of (lapsed ?? []) as Array<{ id: string; parent_id: string; child_name: string }>) {
    summary.pastDue++
    await notifyUser({
      userId: sub.parent_id,
      type: "subscription_past_due",
      title: "Tuition payment overdue",
      message: `${sub.child_name}'s tuition period has ended. Complete the pending payment to continue lessons.`,
      actionUrl: "/parent/payments",
    })
  }

  // 4. Abandoned checkouts (never paid, no proof) — keep renewals alive.
  const abandonedBefore = new Date(now - ABANDONED_CHECKOUT_DAYS * DAY_MS).toISOString()
  const { data: abandoned } = await admin
    .from("transactions")
    .update({ status: "failed", rejection_reason: "Checkout expired", updated_at: new Date(now).toISOString() })
    .eq("status", "pending")
    .is("bank_transfer_proof", null)
    .neq("type", "tuition")
    .lt("created_at", abandonedBefore)
    .select("id, gig_order_id, ai_order_id")
  for (const tx of (abandoned ?? []) as Array<{ id: string; gig_order_id: string | null; ai_order_id: string | null }>) {
    summary.expired++
    if (tx.gig_order_id) await admin.from("gig_orders").update({ status: "cancelled" }).eq("id", tx.gig_order_id).eq("status", "pending")
    if (tx.ai_order_id) await admin.from("ai_orders").update({ status: "cancelled" }).eq("id", tx.ai_order_id).eq("status", "pending")
  }

  return NextResponse.json({ ok: true, ...summary })
}
