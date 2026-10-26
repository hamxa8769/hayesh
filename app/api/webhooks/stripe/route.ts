import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { getStripe, isStripeEnabled, toMinorUnits } from "@/lib/payments/stripe"
import { markTransactionPaid } from "@/lib/payments/settle"
import { claimWebhookEvent, finishWebhookEvent, releaseWebhookEvent } from "@/lib/payments/webhook-events"
import { createAdminClient } from "@/lib/supabase/admin"
import { notifyAdmins } from "@/lib/notifications"

/**
 * POST /api/webhooks/stripe
 *
 * Verifies the Stripe signature against the RAW body, claims the event id
 * (payment_webhook_events) and settles the transaction named in the session
 * metadata. markTransactionPaid is idempotent too, so delivery is safe twice over.
 * Anything that must be retried answers 5xx and releases the claim.
 */

export const maxDuration = 60

const PROVIDER = "stripe"

export async function POST(request: Request) {
  if (!isStripeEnabled()) return NextResponse.json({ error: "Stripe not configured" }, { status: 501 })

  const signature = request.headers.get("stripe-signature")
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 })

  const rawBody = await request.text()
  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET as string)
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return NextResponse.json({ received: true })
  }
  const session = event.data.object as Stripe.Checkout.Session
  const transactionId = session.metadata?.transaction_id
  if (!transactionId || session.payment_status !== "paid") return NextResponse.json({ received: true })

  let claim
  try {
    claim = await claimWebhookEvent(PROVIDER, event.id)
  } catch (error: unknown) {
    console.error("Stripe webhook claim failed", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Could not record event" }, { status: 500 })
  }
  if (claim === "duplicate") return NextResponse.json({ received: true, duplicate: true })

  const { data: tx } = await createAdminClient()
    .from("transactions")
    .select("id, status, gross_amount, currency, reference_code, processor_ref")
    .eq("id", transactionId)
    .maybeSingle()
  if (!tx) {
    // Never 200 a miss: Stripe must retry (the row may not be committed yet).
    await releaseWebhookEvent(PROVIDER, event.id)
    return NextResponse.json({ error: "Transaction not found" }, { status: 500 })
  }

  // The charge must match what we priced — never trust metadata alone.
  const amountMatches =
    session.amount_total === toMinorUnits(Number(tx.gross_amount)) &&
    (session.currency ?? "").toLowerCase() === String(tx.currency).toLowerCase()
  const paidToClosedTx = tx.status !== "pending" && tx.processor_ref !== session.id && tx.processor_ref !== session.payment_intent
  if (!amountMatches || paidToClosedTx) {
    await notifyAdmins({
      type: "payment_submitted",
      title: "Stripe payment needs manual review",
      message: `Card payment ${session.id} for ${tx.reference_code ?? tx.id} ${
        amountMatches ? `arrived after the transaction was ${tx.status as string}` : "does not match the order amount"
      }. Check Stripe and refund or settle manually.`,
      actionUrl: "/admin/payments",
    })
    await finishWebhookEvent(PROVIDER, event.id, "flagged", tx.id as string)
    return NextResponse.json({ received: true, flagged: true })
  }

  const result = await markTransactionPaid(transactionId, {
    processor: "stripe",
    processorRef: typeof session.payment_intent === "string" ? session.payment_intent : session.id,
    paymentMethod: "stripe",
    processorResponse: { session_id: session.id, amount_total: session.amount_total, currency: session.currency },
  })
  if (!result.ok) {
    // Non-2xx makes Stripe retry later.
    await releaseWebhookEvent(PROVIDER, event.id)
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  await finishWebhookEvent(PROVIDER, event.id, result.alreadySettled ? "already_settled" : "settled", transactionId)
  return NextResponse.json({ received: true })
}
