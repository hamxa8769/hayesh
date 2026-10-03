import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { getStripe, isStripeEnabled, toMinorUnits } from "@/lib/payments/stripe"
import { markTransactionPaid } from "@/lib/payments/settle"
import { createAdminClient } from "@/lib/supabase/admin"
import { notifyAdmins } from "@/lib/notifications"

/**
 * POST /api/webhooks/stripe
 *
 * Verifies the Stripe signature against the RAW body, then settles the
 * transaction named in the session metadata. markTransactionPaid is
 * idempotent, so Stripe's at-least-once delivery is safe.
 */

export const maxDuration = 60

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

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session
    const transactionId = session.metadata?.transaction_id
    if (transactionId && session.payment_status === "paid") {
      const { data: tx } = await createAdminClient()
        .from("transactions")
        .select("id, status, gross_amount, currency, reference_code, processor_ref")
        .eq("id", transactionId)
        .maybeSingle()
      if (!tx) return NextResponse.json({ received: true, ignored: "unknown transaction" })

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
        return NextResponse.json({ error: result.error }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ received: true })
}
