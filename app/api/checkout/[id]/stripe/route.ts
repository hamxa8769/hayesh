import { NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth/require-user"
import { rateLimit } from "@/lib/security/rate-limit"
import { createAdminClient } from "@/lib/supabase/admin"
import { stripeProvider } from "@/lib/payments/providers/stripe"
import { PaymentRedirectError } from "@/lib/payments/providers/types"
import type { Transaction } from "@/types/database"

/**
 * POST /api/checkout/[id]/stripe
 *
 * Kept for backwards compatibility; delegates to the Stripe provider adapter
 * (the generic route is /api/checkout/[id]/pay). The webhook — never this
 * redirect — marks the payment paid. Returns 501 until Stripe keys are set.
 */

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid payment id" }, { status: 400 })
  if (!stripeProvider.isEnabled()) return NextResponse.json({ error: "Card payments are not available yet" }, { status: 501 })

  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { user } = auth

  const limited = await rateLimit(`checkout-stripe:${user.userId}`, 10, 60_000)
  if (!limited.ok) return NextResponse.json({ error: "Too many checkout attempts. Please wait a minute." }, { status: 429 })

  const { data } = await createAdminClient().from("transactions").select("*").eq("id", id).eq("payer_id", user.userId).maybeSingle()
  const tx = data as Transaction | null
  if (!tx) return NextResponse.json({ error: "Payment not found" }, { status: 404 })
  if (tx.status !== "pending") return NextResponse.json({ error: "This payment is already settled" }, { status: 409 })

  try {
    const { url } = await stripeProvider.createRedirect(tx, { payerEmail: user.email })
    return NextResponse.json({ url })
  } catch (error: unknown) {
    if (error instanceof PaymentRedirectError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error("Stripe session create failed", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Could not start card payment. Please try another method." }, { status: 502 })
  }
}
