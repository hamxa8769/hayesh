import { createAdminClient } from "@/lib/supabase/admin"
import { notifyAdmins, notifyUser } from "@/lib/notifications"
import { fulfilAIOrder } from "@/lib/ai/fulfil-order"
import type { Transaction } from "@/types/database"

if (typeof window !== "undefined") {
  throw new Error("lib/payments/settle.ts must never be imported client-side")
}

/**
 * Payment settlement — the ONE place an order becomes "paid".
 *
 * Called by the admin verification route (manual bank / wallet rail) and
 * the Stripe webhook. Every transition is a conditional UPDATE on the
 * current status, so retries, double clicks and duplicate webhooks are
 * idempotent: only the first caller wins, later ones get `alreadySettled`.
 */

export interface SettleOptions {
  processor: "manual" | "stripe"
  processorRef?: string
  confirmedBy?: string
  paymentMethod?: string
  processorResponse?: Record<string, unknown>
}

export type SettleResult =
  | { ok: true; alreadySettled: boolean; transaction: Transaction }
  | { ok: false; error: string }

const MONTH_MS = 30 * 24 * 60 * 60 * 1000

function addMonths(base: Date, months: number): Date {
  const d = new Date(base.getTime())
  d.setMonth(d.getMonth() + months)
  return d
}

export async function markTransactionPaid(transactionId: string, opts: SettleOptions): Promise<SettleResult> {
  const admin = createAdminClient()

  const { data: current } = await admin.from("transactions").select("*").eq("id", transactionId).maybeSingle()
  if (!current) return { ok: false, error: "Transaction not found" }
  const tx = current as Transaction
  if (tx.status !== "pending") return { ok: true, alreadySettled: true, transaction: tx }

  // Gig money is held in escrow until the buyer accepts delivery.
  const nextStatus = tx.type === "gig" ? "processing" : "completed"
  const now = new Date().toISOString()

  const { data: updated, error } = await admin
    .from("transactions")
    .update({
      status: nextStatus,
      paid_at: now,
      processor: opts.processor,
      processor_ref: opts.processorRef ?? tx.processor_ref,
      processor_response: opts.processorResponse ?? tx.processor_response,
      payment_method: opts.paymentMethod ?? tx.payment_method,
      bank_transfer_confirmed_by: opts.confirmedBy ?? null,
      bank_transfer_confirmed_at: opts.confirmedBy ? now : null,
      rejection_reason: null,
      updated_at: now,
    })
    .eq("id", transactionId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!updated) {
    const { data: again } = await admin.from("transactions").select("*").eq("id", transactionId).maybeSingle()
    return { ok: true, alreadySettled: true, transaction: (again ?? tx) as Transaction }
  }

  const paid = updated as Transaction
  await activateOrder(paid)
  return { ok: true, alreadySettled: false, transaction: paid }
}

/** Applies the business effect of a cleared payment. Never throws. */
async function activateOrder(tx: Transaction): Promise<void> {
  const admin = createAdminClient()
  const payerId = tx.payer_id ?? ""

  try {
    if (tx.type === "tuition" && tx.subscription_id) {
      const { data: sub } = await admin.from("subscriptions").select("*").eq("id", tx.subscription_id).maybeSingle()
      if (!sub) return
      const now = new Date()
      // Renewals extend from the current period end; first payments start today.
      const currentEnd = sub.current_period_end ? new Date(sub.current_period_end as string) : null
      const start = currentEnd && currentEnd.getTime() > now.getTime() - MONTH_MS && sub.status !== "pending_payment" ? currentEnd : now
      const end = addMonths(start, 1)
      await admin
        .from("subscriptions")
        .update({
          status: "active",
          current_period_start: start.toISOString(),
          current_period_end: end.toISOString(),
          next_billing_date: end.toISOString(),
          payment_method: tx.payment_method,
          updated_at: now.toISOString(),
        })
        .eq("id", tx.subscription_id)

      await notifyUser({
        userId: payerId,
        type: "subscription_activated",
        title: "Tuition active",
        message: `Payment received — ${sub.child_name as string}'s ${sub.subject as string} tuition is active until ${end.toDateString()}.`,
        actionUrl: "/parent/payments",
      })
      if (tx.payee_id) {
        await notifyUser({
          userId: tx.payee_id,
          type: "subscription_activated",
          title: "New paid student",
          message: `${sub.child_name as string} (${sub.subject as string}) is enrolled and paid through ${end.toDateString()}.`,
          actionUrl: "/teacher/students",
        })
      }
      return
    }

    if (tx.type === "gig" && tx.gig_order_id) {
      const { data: order } = await admin
        .from("gig_orders")
        .select("id, gig_id, seller_id, delivery_days, gig_title, status")
        .eq("id", tx.gig_order_id)
        .maybeSingle()
      if (!order || order.status !== "pending") return
      const due = new Date(Date.now() + Number(order.delivery_days ?? 3) * 24 * 60 * 60 * 1000)
      await admin
        .from("gig_orders")
        .update({ status: "in_progress", delivery_due_at: due.toISOString(), payment_method: tx.payment_method, updated_at: new Date().toISOString() })
        .eq("id", order.id)
        .eq("status", "pending")

      const { data: gig } = await admin.from("gigs").select("total_orders").eq("id", order.gig_id).maybeSingle()
      if (gig) await admin.from("gigs").update({ total_orders: Number(gig.total_orders ?? 0) + 1 }).eq("id", order.gig_id)
      const { data: seller } = await admin.from("sellers").select("total_orders").eq("id", order.seller_id).maybeSingle()
      if (seller) await admin.from("sellers").update({ total_orders: Number(seller.total_orders ?? 0) + 1 }).eq("id", order.seller_id)

      await notifyUser({
        userId: payerId,
        type: "payment_confirmed",
        title: "Order started",
        message: `Payment confirmed for "${order.gig_title ?? "your order"}". Delivery due ${due.toDateString()}.`,
        actionUrl: "/buyer/orders",
      })
      if (tx.payee_id) {
        await notifyUser({
          userId: tx.payee_id,
          type: "order_received",
          title: "New paid order",
          message: `You have a new order for "${order.gig_title ?? "your service"}" — due ${due.toDateString()}.`,
          actionUrl: "/seller/orders",
        })
      }
      return
    }

    if (tx.type === "ai_service" && tx.ai_order_id) {
      await notifyUser({
        userId: payerId,
        type: "payment_confirmed",
        title: "Payment confirmed",
        message: "Your HayeshAI Studio order is being generated. You'll find the result in My Orders.",
        actionUrl: "/buyer/orders",
      })
      const result = await fulfilAIOrder(tx.ai_order_id)
      if (result.ok) {
        await notifyUser({
          userId: payerId,
          type: "order_delivered",
          title: "Your AI order is ready",
          message: "HayeshAI Studio has delivered your order.",
          actionUrl: "/buyer/orders",
        })
      }
      return
    }

    if (tx.type === "registration") {
      const role = (tx.meta?.role as string | undefined) ?? ""
      const table = role === "teacher" ? "teachers" : role === "seller" ? "sellers" : null
      if (!table) return
      const patch: Record<string, unknown> = { registration_fee_paid: true }
      if (table === "teachers") patch.registration_fee_amount = tx.gross_amount
      await admin.from(table).update(patch).eq("user_id", payerId)
      await notifyUser({
        userId: payerId,
        type: "registration_paid",
        title: "Registration fee received",
        message: "Thank you — your registration fee is confirmed. Our team will finish reviewing your profile shortly.",
        actionUrl: role === "teacher" ? "/teacher/dashboard" : "/seller/dashboard",
      })
      await notifyAdmins({
        type: "registration_paid",
        title: `${role === "teacher" ? "Teacher" : "Seller"} paid registration`,
        message: "A registration fee was confirmed — the profile is ready for approval review.",
        actionUrl: role === "teacher" ? "/admin/teachers" : "/admin/sellers",
      })
    }
  } catch (error: unknown) {
    console.error("activateOrder failed", tx.id, error instanceof Error ? error.message : error)
  }
}

/** Admin rejects a submitted manual payment (wrong amount, fake proof, …). */
export async function rejectTransaction(transactionId: string, reason: string, rejectedBy: string): Promise<SettleResult> {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data: updated, error } = await admin
    .from("transactions")
    .update({ status: "failed", rejection_reason: reason, bank_transfer_confirmed_by: rejectedBy, updated_at: now })
    .eq("id", transactionId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!updated) return { ok: false, error: "This payment is no longer awaiting review" }

  const tx = updated as Transaction
  if (tx.gig_order_id) {
    await admin.from("gig_orders").update({ status: "cancelled", updated_at: now }).eq("id", tx.gig_order_id).eq("status", "pending")
  }
  if (tx.ai_order_id) {
    await admin.from("ai_orders").update({ status: "cancelled" }).eq("id", tx.ai_order_id).eq("status", "pending")
  }
  if (tx.subscription_id && tx.meta?.period === "first") {
    await admin.from("subscriptions").update({ status: "cancelled", cancelled_at: now }).eq("id", tx.subscription_id).eq("status", "pending_payment")
  }
  if (tx.payer_id) {
    await notifyUser({
      userId: tx.payer_id,
      type: "payment_rejected",
      title: "Payment could not be verified",
      message: `We couldn't verify payment ${tx.reference_code ?? ""}: ${reason}. Please contact support if you believe this is a mistake.`,
      actionUrl: `/checkout/${tx.id}`,
    })
  }
  return { ok: true, alreadySettled: false, transaction: tx }
}

/** Moves a gig order's escrowed transaction to 'completed' so the seller can withdraw it. */
export async function releaseGigEscrow(gigOrderId: string): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from("transactions")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("gig_order_id", gigOrderId)
    .eq("status", "processing")
}

/**
 * Refunds a gig order's still-escrowed payment (dispute resolved for the
 * buyer). Only 'processing' money is refundable — once released it may
 * already have been withdrawn. The money itself is returned off-platform.
 */
export async function refundGigEscrow(gigOrderId: string): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from("transactions")
    .update({ status: "refunded", updated_at: new Date().toISOString() })
    .eq("gig_order_id", gigOrderId)
    .eq("status", "processing")
}
