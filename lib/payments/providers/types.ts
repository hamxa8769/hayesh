import type { Transaction } from "@/types/database"

export type PaymentProviderId = "manual" | "stripe" | "simpaisa"
export type PaymentCurrency = "PKR" | "USD"

export interface VerifiedPaymentEvent {
  eventId: string
  kind: "paid" | "failed" | "ignored"
  transactionId?: string
  amountMinor?: number
  currency?: PaymentCurrency
  processorRef?: string
}

export interface RedirectContext {
  payerEmail?: string
}

/** A gateway that takes the payer off-site and confirms by signed webhook. */
export interface AutomaticPaymentProvider {
  id: Exclude<PaymentProviderId, "manual">
  label: string
  currencies: readonly PaymentCurrency[]
  /** Display labels of the methods it offers, e.g. "Card", "JazzCash". */
  methods: readonly string[]
  isEnabled(): boolean
  createRedirect(tx: Transaction, ctx?: RedirectContext): Promise<{ url: string }>
  /** Verifies the signature against the RAW body and maps it to a neutral event. Throws on a bad signature. */
  parseWebhook(rawBody: string, headers: Headers): Promise<VerifiedPaymentEvent>
}

export class ProviderNotImplementedError extends Error {
  constructor(provider: string) {
    super(`${provider} is not implemented yet — see docs/PAYMENTS-AUTOMATION.md`)
    this.name = "ProviderNotImplementedError"
  }
}

export class WebhookSignatureError extends Error {
  constructor(message = "Invalid signature") {
    super(message)
    this.name = "WebhookSignatureError"
  }
}

export class PaymentRedirectError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = "PaymentRedirectError"
  }
}

/** Public shape handed to the checkout client. */
export interface EnabledProviderInfo {
  id: AutomaticPaymentProvider["id"]
  label: string
  methods: readonly string[]
}
