import { createAdminClient } from "@/lib/supabase/admin"
import { getSiteUrl } from "@/lib/utils/site-url"
import { getStripe, isStripeEnabled, toMinorUnits } from "@/lib/payments/stripe"
import {
  PaymentRedirectError,
  WebhookSignatureError,
  type AutomaticPaymentProvider,
  type PaymentCurrency,
  type VerifiedPaymentEvent,
} from "./types"

/** Adapter over the existing Stripe helpers (lib/payments/stripe.ts). */
export const stripeProvider: AutomaticPaymentProvider = {
  id: "stripe",
  label: "Card",
  currencies: ["PKR", "USD"],
  methods: ["Card"],
  isEnabled: isStripeEnabled,

  async createRedirect(tx, ctx) {
    const admin = createAdminClient()
    const base = getSiteUrl()
    const stripe = getStripe()

    // Reuse a still-open session so one transaction can't be charged twice.
    if (tx.processor_ref?.startsWith("cs_")) {
      const existing = await stripe.checkout.sessions.retrieve(tx.processor_ref)
      if (existing.status === "open" && existing.url) return { url: existing.url }
      if (existing.status === "complete") throw new PaymentRedirectError("This payment is already being confirmed", 409)
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: ctx?.payerEmail || undefined,
        client_reference_id: tx.id,
        metadata: {
          transaction_id: tx.id,
          reference_code: tx.reference_code ?? "",
        },
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
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
        success_url: `${base}/checkout/${tx.id}?stripe=success`,
        cancel_url: `${base}/checkout/${tx.id}?stripe=cancelled`,
      },
      // Same transaction + amount + currency => same key; a changed amount gets a new one.
      {
        idempotencyKey: `checkout-${tx.id}-${toMinorUnits(Number(tx.gross_amount))}-${tx.currency.toLowerCase()}`,
      },
    )
    if (!session.url) throw new PaymentRedirectError("Stripe returned no checkout URL", 502)

    await admin
      .from("transactions")
      .update({
        processor_ref: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tx.id)
    return { url: session.url }
  },

  async parseWebhook(rawBody, headers): Promise<VerifiedPaymentEvent> {
    const signature = headers.get("stripe-signature")
    if (!signature) throw new WebhookSignatureError("Missing signature")
    let event
    try {
      event = getStripe().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET as string)
    } catch {
      throw new WebhookSignatureError()
    }
    if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
      return {
        eventId: event.id,
        kind: event.type === "checkout.session.async_payment_failed" ? "failed" : "ignored",
      }
    }
    const session = event.data.object
    const currency = (session.currency ?? "").toUpperCase()
    return {
      eventId: event.id,
      kind: session.payment_status === "paid" ? "paid" : "ignored",
      transactionId: session.metadata?.transaction_id,
      amountMinor: session.amount_total ?? undefined,
      currency: currency === "PKR" || currency === "USD" ? (currency as PaymentCurrency) : undefined,
      processorRef: typeof session.payment_intent === "string" ? session.payment_intent : session.id,
    }
  },
}
