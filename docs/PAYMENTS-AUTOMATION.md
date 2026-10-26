# Payments: manual now, automatic later

## Today (manual rail — always on)
Payer sees the bank / IBFT / JazzCash / Easypaisa details on `/checkout/[id]`, transfers using the
reference code, uploads a screenshot. An admin confirms in `/admin/payments`; `markTransactionPaid`
(`lib/payments/settle.ts`) then activates the order. This rail is the fallback and never goes away.

## Automatic providers
Registry: `lib/payments/providers/` (`getAutomaticProviders(currency)`). A provider appears on the
checkout page (as an extra tab) only when `isEnabled()` is true. With none enabled the page is the
manual rail only.

| Provider | Status | Enable |
|---|---|---|
| Stripe (card, PKR/USD) | Working | Set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` |
| Simpaisa (JazzCash, Easypaisa, IBFT, cards in PKR) | Scaffold (no wire protocol yet) | See below |

### Stripe
1. Stripe Dashboard -> Developers -> Webhooks -> add `https://<domain>/api/webhooks/stripe`, events
   `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
2. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Vercel, redeploy. Test with `sk_test_` first.

### Simpaisa (developer + operator steps)
1. Get a merchant account and sandbox credentials + API docs from Simpaisa.
2. Fill in the two TODO blocks in `lib/payments/providers/simpaisa.ts`:
   - `createRedirect`: request building, signing, `processor_ref` persistence, hosted-page URL.
   - `parseWebhook`: signature verification on the RAW body, status mapping (`paid`/`failed`/`ignored`),
     stable `eventId`, `amountMinor` (integer paisa) and `currency`.
3. `lib/payments/settle.ts` types `SettleOptions.processor` as `"manual" | "stripe"`; widen it to
   include `"simpaisa"` (the webhook route currently casts).
4. Apply migration `027-payment-webhook-events.sql` (idempotency ledger).
5. Register the webhook `https://<domain>/api/webhooks/simpaisa` in the Simpaisa dashboard.
6. Set `SIMPAISA_MERCHANT_ID`, `SIMPAISA_API_KEY`, `SIMPAISA_WEBHOOK_SECRET`, `SIMPAISA_BASE_URL`
   (sandbox values first). `SIMPAISA_ENABLED` stays `false` until the test plan passes.
7. Sandbox test plan: success per method; failed/cancelled payment (order stays pending, manual rail
   still works); duplicate webhook delivery (second is a no-op); wrong amount (admin notified, not
   settled); bad signature (400); webhook before the transaction exists (500, then retried).
8. Go live: production credentials, then `SIMPAISA_ENABLED=true`. Admin -> System status shows
   "Automatic PK payments (Simpaisa)" as OK.

## Webhook safety (all providers)
Each event id is claimed in `payment_webhook_events` before settling (duplicates are no-ops; a claim
that never finished is retried after 10 minutes). Amount + currency are checked against the
transaction; mismatches notify admins instead of settling. Unknown transaction or settle failure
answers 500 so the provider retries.
