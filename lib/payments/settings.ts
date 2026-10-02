import { createAdminClient } from "@/lib/supabase/admin"

if (typeof window !== "undefined") {
  throw new Error("lib/payments/settings.ts must never be imported client-side")
}

export interface PaymentAccounts {
  bankName: string
  accountTitle: string
  accountNumber: string
  iban: string
  jazzcashNumber: string
  easypaisaNumber: string
  instructions: string
}

export interface CommerceSettings {
  teacherCommissionPct: number
  sellerCommissionPct: number
  teacherRegistrationFeePkr: number
  sellerRegistrationFeePkr: number
  gigAutoCompleteDays: number
  accounts: PaymentAccounts
}

const DEFAULTS = {
  teacher_commission_pct: 15,
  seller_commission_pct: 18,
  teacher_registration_fee_pkr: 2000,
  seller_registration_fee_pkr: 1000,
  gig_auto_complete_days: 3,
}

function toNumber(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? Number(value) : value
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : fallback
}

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/** Reads admin-configured commission, fees and payee accounts from platform_settings. */
export async function getCommerceSettings(): Promise<CommerceSettings> {
  const admin = createAdminClient()
  const { data } = await admin.from("platform_settings").select("key, value")
  const map = new Map<string, unknown>((data ?? []).map((row: { key: string; value: unknown }) => [row.key, row.value]))

  return {
    teacherCommissionPct: Math.min(100, toNumber(map.get("teacher_commission_pct"), DEFAULTS.teacher_commission_pct)),
    sellerCommissionPct: Math.min(100, toNumber(map.get("seller_commission_pct"), DEFAULTS.seller_commission_pct)),
    teacherRegistrationFeePkr: toNumber(map.get("teacher_registration_fee_pkr"), DEFAULTS.teacher_registration_fee_pkr),
    sellerRegistrationFeePkr: toNumber(map.get("seller_registration_fee_pkr"), DEFAULTS.seller_registration_fee_pkr),
    gigAutoCompleteDays: Math.max(1, toNumber(map.get("gig_auto_complete_days"), DEFAULTS.gig_auto_complete_days)),
    accounts: {
      bankName: toText(map.get("payment_bank_name")),
      accountTitle: toText(map.get("payment_account_title")),
      accountNumber: toText(map.get("payment_account_number")),
      iban: toText(map.get("payment_iban")),
      jazzcashNumber: toText(map.get("payment_jazzcash_number")),
      easypaisaNumber: toText(map.get("payment_easypaisa_number")),
      instructions: toText(map.get("payment_instructions")),
    },
  }
}

/** Splits a gross amount into platform fee + payee net, rounded to 2dp. */
export function splitCommission(gross: number, commissionPct: number): { fee: number; net: number } {
  const fee = Math.round(gross * commissionPct) / 100
  return { fee, net: Math.round((gross - fee) * 100) / 100 }
}
