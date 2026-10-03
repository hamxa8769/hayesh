import Stripe from "stripe"

if (typeof window !== "undefined") {
  throw new Error("lib/payments/stripe.ts must never be imported client-side")
}

/** Card payments are offered only once the operator sets Stripe keys. */
export function isStripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)
}

let client: Stripe | null = null

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("Stripe is not configured")
  if (!client) client = new Stripe(key)
  return client
}

/** Stripe amounts are integers in the currency's minor unit (PKR and USD are both 2-decimal). */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100)
}
