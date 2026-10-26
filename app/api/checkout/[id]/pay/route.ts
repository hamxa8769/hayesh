import { NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { getProvider, PaymentRedirectError, ProviderNotImplementedError } from "@/lib/payments/providers"
import type { Transaction } from "@/types/database"

/**
 * POST /api/checkout/[id]/pay  { provider }
 *
 * Starts an automatic (redirect) payment for a pending transaction and
 * returns the gateway URL. Settlement happens only via the provider webhook.
 */

const bodySchema = z.object({ provider: z.enum(["stripe", "simpaisa"]) })

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid payment id" }, { status: 400 })
  const body = bodySchema.safeParse(await request.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: "Unknown payment provider" }, { status: 400 })

  const provider = getProvider(body.data.provider)
  if (!provider || !provider.isEnabled()) return NextResponse.json({ error: "This payment method is not available yet" }, { status: 501 })

  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { user } = auth

  const { data } = await createAdminClient().from("transactions").select("*").eq("id", id).eq("payer_id", user.userId).maybeSingle()
  const tx = data as Transaction | null
  if (!tx) return NextResponse.json({ error: "Payment not found" }, { status: 404 })
  if (tx.status !== "pending") return NextResponse.json({ error: "This payment is already settled" }, { status: 409 })
  if (tx.currency !== "PKR" && tx.currency !== "USD") return NextResponse.json({ error: "Unsupported currency" }, { status: 400 })
  if (!provider.currencies.includes(tx.currency)) {
    return NextResponse.json({ error: `${provider.label} does not support ${tx.currency}` }, { status: 400 })
  }

  try {
    const { url } = await provider.createRedirect(tx, { payerEmail: user.email })
    return NextResponse.json({ url })
  } catch (error: unknown) {
    if (error instanceof ProviderNotImplementedError) return NextResponse.json({ error: "This payment method is not available yet" }, { status: 501 })
    if (error instanceof PaymentRedirectError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error("Payment redirect failed", provider.id, error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Could not start online payment. Please try another method." }, { status: 502 })
  }
}
