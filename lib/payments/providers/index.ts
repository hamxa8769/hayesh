import { stripeProvider } from "./stripe"
import { simpaisaProvider } from "./simpaisa"
import type { AutomaticPaymentProvider, EnabledProviderInfo, PaymentCurrency } from "./types"

export * from "./types"

const PROVIDERS: readonly AutomaticPaymentProvider[] = [stripeProvider, simpaisaProvider]

export function getProvider(id: string): AutomaticPaymentProvider | undefined {
  return PROVIDERS.find((p) => p.id === id)
}

/** Enabled automatic providers that can charge in `currency`. Empty when nothing is configured. */
export function getAutomaticProviders(currency: PaymentCurrency): AutomaticPaymentProvider[] {
  return PROVIDERS.filter((p) => p.isEnabled() && p.currencies.includes(currency))
}

export function toProviderInfo(p: AutomaticPaymentProvider): EnabledProviderInfo {
  return { id: p.id, label: p.label, methods: p.methods }
}
