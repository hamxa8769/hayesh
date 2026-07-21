import { z } from "zod"

/**
 * Withdrawal / payout account shapes shared by the teacher and seller
 * profile editors and by app/api/payout-accounts/route.ts.
 *
 * Storage decision: there is no dedicated `payout_accounts` table. Bank
 * details for one-off requests currently live per-row on `public.payouts`
 * (see app/api/payouts/route.ts), but that table has no concept of a
 * *saved, reusable* account — every withdrawal request re-enters bank
 * details from scratch. `public.payment_methods` (migration 011) is
 * already exactly shaped for a saved instrument (method, label,
 * account_last4, encrypted account_reference, is_default) and already has
 * working RLS ("Owner manages own payment methods" — full control of own
 * rows; admins can SELECT but never write). Reusing it avoids a migration
 * this task is not permitted to write, and keeps a single well-audited
 * encrypted-bank-details code path instead of a second one.
 *
 * The table's `label`/`account_reference` are generic (it also stores a
 * parent's saved card/wallet reference for paying tuition — see
 * app/api/payment-methods/route.ts). For a payout account specifically we
 * want bank_name / account_title / iban as distinct inputs, so:
 *   - `account_number` and `iban` are combined into one JSON string and
 *     encrypted into `account_reference` (AES-256-GCM, server-only —
 *     see lib/crypto/field-encryption.ts).
 *   - `bank_name` / `account_title` are non-sensitive routing labels, not
 *     account credentials, so they are folded into the plaintext `label`
 *     column (same treatment the sibling payment-methods route already
 *     gives a human-readable nickname).
 *   - `account_last4` is derived server-side from whichever of
 *     iban/account_number is more specific, never trusted from the client.
 */
export const PAYOUT_METHOD_VALUES = ["stripe", "jazzcash", "easypaisa", "ibft", "bank_transfer", "card_pk"] as const
export type PayoutMethodValue = (typeof PAYOUT_METHOD_VALUES)[number]

export const PAYOUT_METHOD_LABELS: Record<PayoutMethodValue, string> = {
  ibft: "IBFT (Raast bank transfer)",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
  bank_transfer: "Bank Transfer",
  card_pk: "Card (PKR)",
  stripe: "Stripe Connect (international)",
}

const BANK_DETAIL_METHODS: PayoutMethodValue[] = ["ibft", "bank_transfer"]

export const payoutAccountSchema = z
  .object({
    payment_method: z.enum(PAYOUT_METHOD_VALUES, { error: "Select a payout method" }),
    bank_name: z.string().trim().max(120, "Keep it under 120 characters").optional(),
    account_title: z.string().trim().max(120, "Keep it under 120 characters").optional(),
    account_number: z.string().trim().min(4, "Enter a valid account number").max(60, "Too long"),
    iban: z.string().trim().max(40, "Keep it under 40 characters").optional(),
    is_default: z.boolean().optional(),
  })
  .superRefine((values, ctx) => {
    if (BANK_DETAIL_METHODS.includes(values.payment_method) && !values.bank_name?.trim()) {
      ctx.addIssue({ code: "custom", path: ["bank_name"], message: "Bank name is required for bank transfers" })
    }
  })

export type PayoutAccountValues = z.infer<typeof payoutAccountSchema>

export const updatePayoutAccountSchema = payoutAccountSchema.and(z.object({ id: z.string().uuid() }))
export type UpdatePayoutAccountValues = z.infer<typeof updatePayoutAccountSchema>

/**
 * Row shape returned by the API for display ONLY — never includes
 * `account_reference` (the ciphertext), and never a decrypted value.
 */
export interface PayoutAccountListItem {
  id: string
  method: PayoutMethodValue
  label: string | null
  account_last4: string | null
  is_default: boolean | null
  created_at: string | null
}
