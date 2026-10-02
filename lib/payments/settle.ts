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

/**
 * Repairs payments whose activation was interrupted (function timeout,
 * transient DB error): paid gig/tuition transactions whose order is still
 * waiting for payment, and completed gig orders whose escrow wasn't
 * released. Run by the daily cron. Returns how many rows were repaired.
 */
export async function reconcilePaidOrders(): Promise<number> {
  const admin = createAdminClient()
  let repaired = 0

  const { data: paidGig } = await admin
    .from("transactions")
    .select("*, gig_orders!inner(status)")
    .eq("type", "gig")
    .eq("status", "processing")
    .eq("gig_orders.status", "pending")
    .limit(100)
  const { data: paidTuition } = await admin
    .from("transactions")
    .select("*, subscriptions!inner(status)")
    .eq("type", "tuition")
    .eq("status", "completed")
    .eq("subscriptions.status", "pending_payment")
    .limit(100)
  for (const row of [...(paidGig ?? []), ...(paidTuition ?? [])] as Transaction[]) {
    await activateOrder(row)
    repaired++
  }

  const { data: unreleased } = await admin
    .from("transactions")
    .select("gig_order_id, gig_orders!inner(status)")
    .eq("type", "gig")
    .eq("status", "processing")
    .eq("gig_orders.status", "completed")
    .limit(100)
  for (const row of (unreleased ?? []) as Array<{ gig_order_id: string | null }>) {
    if (row.gig_order_id) {
      await releaseGigEscrow(row.gig_order_id)
      repaired++
    }
  }
  return repaired
}

/** Applies the business effect of a cleared payment. Never throws. */
async function activateOrder(tx: Transaction): Promise<void> {
  const admin = createAdminClient()
  const payerId = tx.payer_id ?? ""

  try {
    if (tx.type === "tuition" && tx.subscription_id) {
      const { data: sub } = await admin.from("subscriptions").select("*").eq("id", tx.subscription_id).maybeSingle()
      if (!sub) return
      if (sub.status === "cancelled") {
        await notifyAdmins({
          type: "payment_confirmed",
          title: "Payment for a cancelled tuition plan",
          message: `Transaction ${tx.reference_code ?? tx.id} was paid but its subscription is cancelled — refund or reactivate manually.`,
          actionUrl: "/admin/payments",
        })
        return
      }
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
        .in("status", ["pending_payment", "active", "past_due"])

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
        actionUrl: "/orders",
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
        actionUrl: "/orders",
      })
      const result = await fulfilAIOrder(tx.ai_order_id)
      if (result.ok) {
        await notifyUser({
          userId: payerId,
          type: "order_delivered",
          title: "Your AI order is ready",
          message: "HayeshAI Studio has delivered your order.",
          actionUrl: "/orders",
        })
      }
      return
    }

    if (tx.type === "featured") {
      const role = (tx.meta?.role as string | undefined) ?? ""
      const table = role === "teacher" ? "teachers" : role === "seller" ? "sellers" : null
      const days = Number(tx.meta?.days)
      if (!table || !Number.isFinite(days) || days <= 0) return
      const { data: row } = await admin.from(table).select("featured_until").eq("user_id", payerId).maybeSingle()
      const now = Date.now()
      const currentEnd = (row as { featured_until: string | null } | null)?.featured_until
      const base = Math.max(now, currentEnd ? new Date(currentEnd).getTime() : 0)
      const until = new Date(base + days * 24 * 60 * 60 * 1000)
      await admin.from(table).update({ featured: true, featured_until: until.toISOString() }).eq("user_id", payerId)
      await notifyUser({
        userId: payerId,
        type: "payment_confirmed",
        title: "You're featured",
        message: `You're featured until ${until.toDateString()}.`,
        actionUrl: role === "teacher" ? "/teacher/dashboard" : "/seller/dashboard",
      })
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

export type RefundResult = { ok: true; transaction: Transaction } | { ok: false; error: string; status: number }

/**
 * Admin refund of a paid transaction. The money itself goes back off-platform;
 * this reverses the business effect and marks the transaction 'refunded'.
 * Completed payments with a payee are refused when the payee has already
 * withdrawn the funds (mirrors the balance maths in migration 007).
 */
export async function refundTransaction(transactionId: string, reason: string, adminId: string): Promise<RefundResult> {
  const admin = createAdminClient()
  const { data: current } = await admin.from("transactions").select("*").eq("id", transactionId).maybeSingle()
  if (!current) return { ok: false, error: "Transaction not found", status: 404 }
  const tx = current as Transaction
  if (tx.status !== "completed" && tx.status !== "processing") {
    return { ok: false, error: "Only completed or in-escrow payments can be refunded", status: 409 }
  }

  if (tx.status === "completed" && tx.payee_id && Number(tx.net_amount) > 0) {
    const { data: earnedRows } = await admin
      .from("transactions")
      .select("net_amount")
      .eq("payee_id", tx.payee_id)
      .eq("status", "completed")
      .eq("currency", tx.currency)
    const { data: payoutRows } = await admin
      .from("payouts")
      .select("amount")
      .eq("recipient_id", tx.payee_id)
      .eq("currency", tx.currency)
      .neq("status", "failed")
    const earned = ((earnedRows ?? []) as Array<{ net_amount: number | null }>).reduce((sum, r) => sum + Number(r.net_amount ?? 0), 0)
    const claimed = ((payoutRows ?? []) as Array<{ amount: number | null }>).reduce((sum, r) => sum + Number(r.amount ?? 0), 0)
    if (earned - claimed < Number(tx.net_amount)) {
      return { ok: false, error: "Payee has already withdrawn these funds — recover manually first", status: 409 }
    }
  }

  const now = new Date().toISOString()
  const { data: updated, error } = await admin
    .from("transactions")
    .update({ status: "refunded", rejection_reason: reason, bank_transfer_confirmed_by: adminId, updated_at: now })
    .eq("id", transactionId)
    .eq("status", tx.status)
    .select("*")
    .maybeSingle()
  if (error) return { ok: false, error: error.message, status: 500 }
  if (!updated) return { ok: false, error: "This payment was already changed by someone else", status: 409 }
  const refunded = updated as Transaction

  try {
    if (refunded.type === "gig" && refunded.gig_order_id) {
      await admin.from("gig_orders").update({ status: "cancelled", updated_at: now }).eq("id", refunded.gig_order_id)
    } else if (refunded.type === "tuition" && refunded.subscription_id) {
      await admin.from("subscriptions").update({ status: "cancelled", cancelled_at: now, updated_at: now }).eq("id", refunded.subscription_id)
    } else if (refunded.type === "registration" || refunded.type === "featured") {
      const role = (refunded.meta?.role as string | undefined) ?? ""
      const table = role === "teacher" ? "teachers" : role === "seller" ? "sellers" : null
      if (table && refunded.payer_id) {
        const patch = refunded.type === "registration" ? { registration_fee_paid: false } : { featured: false }
        await admin.from(table).update(patch).eq("user_id", refunded.payer_id)
      }
    }
  } catch (e: unknown) {
    console.error("refundTransaction effects failed", refunded.id, e instanceof Error ? e.message : e)
  }

  if (refunded.payer_id) {
    await notifyUser({
      userId: refunded.payer_id,
      type: "dispute_resolved",
      title: "Refund issued",
      message: `Your payment ${refunded.reference_code ?? ""} was refunded: ${reason}. The money is returned through your original payment channel.`,
      actionUrl: `/checkout/${refunded.id}`,
    })
  }
  return { ok: true, transaction: refunded }
}
