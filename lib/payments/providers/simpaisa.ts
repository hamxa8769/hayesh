import { ProviderNotImplementedError, type AutomaticPaymentProvider } from "./types"

/**
 * Simpaisa (JazzCash / Easypaisa / IBFT / cards in PKR) — SCAFFOLD ONLY.
 *
 * We have no merchant account or API documentation yet, so nothing here
 * speaks the Simpaisa wire protocol. Enable only after the TODOs below are
 * filled in and verified against the sandbox (docs/PAYMENTS-AUTOMATION.md).
 */

const REQUIRED_ENV = ["SIMPAISA_MERCHANT_ID", "SIMPAISA_API_KEY", "SIMPAISA_WEBHOOK_SECRET", "SIMPAISA_BASE_URL"] as const

export function isSimpaisaEnabled(): boolean {
  if (process.env.SIMPAISA_ENABLED !== "true") return false
  return REQUIRED_ENV.every((name) => Boolean(process.env[name]?.trim()))
}

export const simpaisaProvider: AutomaticPaymentProvider = {
  id: "simpaisa",
  label: "Pay online (Pakistan)",
  currencies: ["PKR"],
  methods: ["JazzCash", "Easypaisa", "Bank (IBFT)", "Card"],
  isEnabled: isSimpaisaEnabled,

  async createRedirect() {
    // TODO(simpaisa): once the API docs are available, implement:
    //  1. Build the payment-initiation request from `tx`: amount in the unit the
    //     API expects (PKR), our `tx.reference_code` / `tx.id` as the merchant
    //     order id so the webhook can find the transaction, and return URLs
    //     `${getSiteUrl()}/checkout/${tx.id}?simpaisa=success|cancelled`.
    //  2. Sign the request exactly as documented (SIMPAISA_MERCHANT_ID,
    //     SIMPAISA_API_KEY) and POST it to SIMPAISA_BASE_URL + <documented path>.
    //  3. Persist the gateway's session/order id in transactions.processor_ref
    //     (reuse an open session instead of creating a second one).
    //  4. Return { url } of the hosted payment page.
    throw new ProviderNotImplementedError("Simpaisa")
  },

  async parseWebhook() {
    // TODO(simpaisa): once the API docs are available, implement:
    //  1. Verify the signature/HMAC of `rawBody` (and relevant headers) with
    //     SIMPAISA_WEBHOOK_SECRET using a constant-time compare; throw
    //     WebhookSignatureError on mismatch. Use the RAW body, never re-serialised JSON.
    //  2. Map the gateway status to kind: success -> "paid", failure/expired ->
    //     "failed", everything else -> "ignored". Never treat a redirect as proof.
    //  3. Return a stable `eventId` (gateway event/notification id, or its
    //     transaction id + status), `transactionId` (our id echoed back),
    //     `amountMinor` (integer paisa), `currency: "PKR"` and `processorRef`.
    //     The webhook route compares amountMinor/currency to the order before settling.
    throw new ProviderNotImplementedError("Simpaisa")
  },
}
