# Skill: Payment Rules (Stripe + Simpaisa)

There are exactly **three** payment types on Hayesh. Never mix their logic — each has its own commission rate, webhook handling, and payout path.

## Type 1 — Monthly Tuition (Teacher subscriptions)
- Stripe Subscriptions (international) or Simpaisa recurring charge (Pakistan, `user.country === 'PK'`)
- Charged **upfront**, only after the demo lesson is approved by the parent
- Platform takes **15%** (admin-configurable) before the teacher payout
- Payout to teacher happens **after month-end**, not upfront — platform holds float to cover disputes
- Payout rail: Stripe Connect (international) / Simpaisa IBFT (Pakistan)
- Webhooks to handle idempotently: `customer.subscription.created`, `payment_intent.succeeded`

## Type 2 — Gig Purchase (Marketplace, Layer 2)
- One-time Stripe `PaymentIntent` (international) or Simpaisa one-time charge (Pakistan)
- Platform takes **18%** (admin-configurable) before seller payout
- Order status lifecycle: `pending` → `in_progress` → `delivered` → `complete`
- Payout rail: Stripe Connect / Simpaisa IBFT, released after order marked complete

## Type 3 — AI Service Purchase (Layer 3, HayeshAI Studio)
- One-time Stripe `PaymentIntent` / Simpaisa one-time charge
- Platform keeps **100%** — no human payout, ever
- Fulfilled automatically by the admin-configured Claude API agent
- Delivery status pushed via Supabase Realtime, not polling

## Manual bank transfer flow (all types, Pakistan fallback)
1. User selects "Bank Transfer" at checkout
2. Hayesh shows its bank account details
3. User transfers and uploads a screenshot as proof
4. Admin verifies the screenshot in the admin dashboard and clicks "Confirm Payment"
5. Supabase marks the subscription/order active
6. JARVIS automatically notifies the teacher/seller

## Always
- All Stripe/Simpaisa calls happen server-side only (API routes) — never expose secret keys client-side
- Write the order/subscription record to Supabase immediately on initiation, before waiting on the webhook
- Handle every webhook idempotently (a webhook may be delivered more than once)
- Country detection (`user.country === 'PK'` → Simpaisa, else Stripe) can be overridden per-user by admin
