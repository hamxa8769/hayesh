import { z } from "zod"

/**
 * Payment methods a teacher can request a payout through. Mirrors the
 * `payment_method` enum in supabase-schema.sql, scoped to release-capable
 * methods (card_pk is a charge method, not a payout method, so it is omitted).
 */
export const PAYOUT_METHOD_OPTIONS = [
  { value: "ibft", label: "IBFT (Raast bank transfer)" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "easypaisa", label: "Easypaisa" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "stripe", label: "Stripe Connect (international)" },
] as const

export type PayoutMethodValue = (typeof PAYOUT_METHOD_OPTIONS)[number]["value"]

const BANK_DETAIL_METHODS: PayoutMethodValue[] = ["ibft", "bank_transfer"]

/**
 * Builds the withdrawal-request schema with the caller's current available
 * balance baked in, so "amount <= available balance" is enforced at the
 * form layer before the insert ever reaches Supabase / RLS.
 */
export function createWithdrawalSchema(maxAmount: number) {
  return z
    .object({
      amount: z
        .number({ error: "Enter an amount" })
        .finite("Enter a valid amount")
        .positive("Amount must be greater than zero")
        .max(maxAmount, `Cannot exceed your available balance`),
      currency: z.enum(["PKR", "USD"]),
      payment_method: z.enum(["ibft", "jazzcash", "easypaisa", "bank_transfer", "stripe"], {
        error: "Select a payout method",
      }),
      bank_name: z.string().trim().max(120, "Keep it under 120 characters").optional(),
      account_number: z.string().trim().min(4, "Enter a valid account number").max(60, "Too long"),
      iban: z.string().trim().max(40, "Keep it under 40 characters").optional(),
      notes: z.string().trim().max(300, "Keep it under 300 characters").optional(),
    })
    .superRefine((values, ctx) => {
      if (BANK_DETAIL_METHODS.includes(values.payment_method) && !values.bank_name?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["bank_name"],
          message: "Bank name is required for bank transfers",
        })
      }
    })
}

export type WithdrawalValues = z.infer<ReturnType<typeof createWithdrawalSchema>>
