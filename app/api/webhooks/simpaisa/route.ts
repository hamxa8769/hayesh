import { NextResponse } from "next/server"
import { getProvider, ProviderNotImplementedError, WebhookSignatureError } from "@/lib/payments/providers"
import { markTransactionPaid, type SettleOptions } from "@/lib/payments/settle"
import { claimWebhookEvent, finishWebhookEvent, releaseWebhookEvent } from "@/lib/payments/webhook-events"
import { toMinorUnits } from "@/lib/payments/stripe"
import { createAdminClient } from "@/lib/supabase/admin"
import { notifyAdmins } from "@/lib/notifications"

/**
 * POST /api/webhooks/simpaisa
 *
 * Same shape as the Stripe webhook; only lib/payments/providers/simpaisa.ts
 * (signature check + status mapping) needs filling in. 404 while disabled.
 */

export const maxDuration = 60

const PROVIDER = "simpaisa"

export async function POST(request: Request) {
  const provider = getProvider(PROVIDER)
  if (!provider || !provider.isEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const rawBody = await request.text()
  let parsed
  try {
    parsed = await provider.parseWebhook(rawBody, request.headers)
  } catch (error: unknown) {
    if (error instanceof WebhookSignatureError) return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    if (error instanceof ProviderNotImplementedError) return NextResponse.json({ error: "Not implemented" }, { status: 501 })
    console.error("Simpaisa webhook parse failed", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Could not parse event" }, { status: 400 })
  }

  if (parsed.kind === "ignored" || !parsed.transactionId) return NextResponse.json({ received: true })

  let claim
  try {
    claim = await claimWebhookEvent(PROVIDER, parsed.eventId)
  } catch (error: unknown) {
    console.error("Simpaisa webhook claim failed", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Could not record event" }, { status: 500 })
  }
  if (claim === "duplicate") return NextResponse.json({ received: true, duplicate: true })

  const { data: tx } = await createAdminClient()
    .from("transactions")
    .select("id, status, gross_amount, currency, reference_code, processor_ref")
    .eq("id", parsed.transactionId)
    .maybeSingle()
  if (!tx) {
    await releaseWebhookEvent(PROVIDER, parsed.eventId)
    return NextResponse.json({ error: "Transaction not found" }, { status: 500 })
  }

  if (parsed.kind === "failed") {
    // Leave the transaction pending: the payer can retry or use the manual rail.
    await finishWebhookEvent(PROVIDER, parsed.eventId, "failed", tx.id as string)
    return NextResponse.json({ received: true })
  }

  const amountMatches =
    parsed.amountMinor === toMinorUnits(Number(tx.gross_amount)) &&
    (parsed.currency ?? "").toUpperCase() === String(tx.currency).toUpperCase()
  if (!amountMatches) {
    await notifyAdmins({
      type: "payment_submitted",
      title: "Simpaisa payment needs manual review",
      message: `Online payment ${parsed.processorRef ?? parsed.eventId} for ${tx.reference_code ?? tx.id} does not match the order amount. Check Simpaisa and refund or settle manually.`,
      actionUrl: "/admin/payments",
    })
    await finishWebhookEvent(PROVIDER, parsed.eventId, "flagged", tx.id as string)
    return NextResponse.json({ received: true, flagged: true })
  }

  const result = await markTransactionPaid(parsed.transactionId, {
    // settle.ts types `processor` as "manual" | "stripe"; widen it to include "simpaisa".
    processor: PROVIDER,
    processorRef: parsed.processorRef,
    paymentMethod: PROVIDER,
  })
  if (!result.ok) {
    await releaseWebhookEvent(PROVIDER, parsed.eventId)
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  await finishWebhookEvent(PROVIDER, parsed.eventId, result.alreadySettled ? "already_settled" : "settled", parsed.transactionId)
  return NextResponse.json({ received: true })
}
