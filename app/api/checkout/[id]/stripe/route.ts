import { NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { getStripe, isStripeEnabled, toMinorUnits } from "@/lib/payments/stripe"
import { getSiteUrl } from "@/lib/utils/site-url"
import type { Transaction } from "@/types/database"

/**
 * POST /api/checkout/[id]/stripe
 *
 * Creates a Stripe Checkout Session for a pending transaction and returns
 * its hosted URL. The webhook (/api/webhooks/stripe) — never this redirect —
 * is what marks the payment paid. Returns 501 until Stripe keys are set.
 */

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid payment id" }, { status: 400 })
  if (!isStripeEnabled()) return NextResponse.json({ error: "Card payments are not available yet" }, { status: 501 })

  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { user } = auth

  const admin = createAdminClient()
  const { data } = await admin.from("transactions").select("*").eq("id", id).eq("payer_id", user.userId).maybeSingle()
  const tx = data as Transaction | null
  if (!tx) return NextResponse.json({ error: "Payment not found" }, { status: 404 })
  if (tx.status !== "pending") return NextResponse.json({ error: "This payment is already settled" }, { status: 409 })

  const base = getSiteUrl()
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: user.email || undefined,
      client_reference_id: tx.id,
      metadata: { transaction_id: tx.id, reference_code: tx.reference_code ?? "" },
      payment_intent_data: { metadata: { transaction_id: tx.id } },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: tx.currency.toLowerCase(),
            unit_amount: toMinorUnits(Number(tx.gross_amount)),
            product_data: { name: tx.description ?? "Hayesh order" },
          },
        },
      ],
      success_url: `${base}/checkout/${tx.id}?stripe=success`,
      cancel_url: `${base}/checkout/${tx.id}?stripe=cancelled`,
    })

    await admin.from("transactions").update({ processor_ref: session.id, updated_at: new Date().toISOString() }).eq("id", tx.id)
    return NextResponse.json({ url: session.url })
  } catch (error: unknown) {
    console.error("Stripe session create failed", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Could not start card payment. Please try another method." }, { status: 502 })
  }
}
