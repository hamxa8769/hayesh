import { z } from "zod"
import type { PaymentMethod } from "@/types/database"

/**
 * UI-facing payment method options shown on /parent/payments. This is
 * DELIBERATELY a subset of the six public.payment_method enum values
 * (migration 011): 'stripe' is intentionally omitted from the picker
 * because Card here means a Pakistani card charge (`card_pk`) — no Stripe
 * keys exist yet for the international flow (see CLAUDE.md payment
 * architecture: Simpaisa for PK users, Stripe for international).
 *
 * NayaPay has no dedicated enum value in the database. It is mapped onto
 * 'ibft' — NayaPay accounts settle via IBAN/Raast interbank transfer, which
 * is exactly what the 'ibft' enum value represents, whereas 'bank_transfer'
 * is reserved in this UI for the manual "transfer + upload proof" flow
 * described in CLAUDE.md. The human-readable label "NayaPay" is stored in
 * payment_methods.label so the distinction is visible to the user even
 * though the underlying enum value is shared with any other IBFT method.
 */
export const PAYMENT_METHOD_OPTIONS = ["card_pk", "jazzcash", "easypaisa", "ibft", "bank_transfer"] as const
export type PaymentMethodOption = (typeof PAYMENT_METHOD_OPTIONS)[number]

export const PAYMENT_METHOD_OPTION_LABELS: Record<PaymentMethodOption, string> = {
  card_pk: "Card",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
  ibft: "NayaPay",
  bank_transfer: "Bank Transfer",
}

/** Placeholder + helper copy shown under the account reference field, per method. */
export const PAYMENT_METHOD_REFERENCE_HINT: Record<PaymentMethodOption, string> = {
  card_pk: "Card number",
  jazzcash: "JazzCash mobile account number",
  easypaisa: "Easypaisa mobile account number",
  ibft: "NayaPay account / IBAN",
  bank_transfer: "Bank account number / IBAN",
}

/** Label for the account-holder-name field, worded per method. */
export const PAYMENT_METHOD_HOLDER_LABEL: Record<PaymentMethodOption, string> = {
  card_pk: "Name on card",
  jazzcash: "JazzCash account holder name",
  easypaisa: "Easypaisa account holder name",
  ibft: "NayaPay account holder name",
  bank_transfer: "Bank account holder name",
}

/** Client form schema — mirrors the server-side schema in app/api/payment-methods/route.ts. */
export const paymentMethodFormSchema = z.object({
  method: z.enum(PAYMENT_METHOD_OPTIONS, { error: "Choose a payment method" }),
  label: z.string().trim().max(60, "Keep it under 60 characters").optional(),
  // The name on the wallet / card / bank account. Required for every method:
  // a mobile-wallet or bank transfer can't be reconciled without knowing whose
  // account it is, and cards carry a cardholder name too.
  account_holder_name: z
    .string()
    .trim()
    .min(2, "Enter the account holder's name")
    .max(80, "Keep it under 80 characters"),
  account_reference: z
    .string()
    .trim()
    .min(4, "Enter at least 4 characters")
    .max(60, "Keep it under 60 characters"),
  is_default: z.boolean(),
})

export type PaymentMethodFormValues = z.infer<typeof paymentMethodFormSchema>

/**
 * Row shape returned by the server for display purposes ONLY. Note there is
 * no `account_reference` field here — the API route never returns the
 * encrypted value, and the payments page never selects that column from
 * Supabase directly, so there is nothing to accidentally render raw.
 */
export interface PaymentMethodListItem {
  id: string
  method: PaymentMethod
  label: string | null
  account_holder_name: string | null
  account_last4: string | null
  is_default: boolean | null
  created_at: string | null
}
