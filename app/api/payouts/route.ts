import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { encryptField } from "@/lib/crypto/field-encryption"

/**
 * POST /api/payouts — teacher/seller withdrawal request intake.
 *
 * This route exists so bank account numbers and IBANs are ENCRYPTED
 * server-side before they ever reach Postgres. The previous flow had
 * app/teacher/earnings/page.tsx (a client component) insert directly into
 * public.payouts from the browser, which meant plaintext bank details went
 * straight from the user's machine into the database with no encryption
 * layer at all — despite the schema comments claiming "encrypted at app
 * layer". This route is that app layer.
 *
 * We use the normal server Supabase client (cookie-based, RLS-scoped),
 * NOT the service-role admin client. Two reasons:
 *   1. RLS already has a working "Recipient requests own payout" INSERT
 *      policy (supabase-migrations/006-core-rls-policies.sql) — no need to
 *      bypass it with the service role.
 *   2. migration 007's validate_payout_request() BEFORE INSERT trigger
 *      short-circuits (skips the balance check) when auth.uid() is null,
 *      which is exactly the service-role's identity. Using the service-role
 *      client here would silently disable the escrow-balance guard for
 *      every request submitted through this route. The normal server
 *      client preserves the caller's JWT, so auth.uid() is the real
 *      recipient and the trigger's balance check stays in force.
 */

const payoutRequestSchema = z.object({
  amount: z.number().finite().positive(),
  currency: z.enum(["PKR", "USD"]),
  payment_method: z.enum(["ibft", "jazzcash", "easypaisa", "bank_transfer", "stripe"]),
  bank_name: z.string().trim().max(120).optional(),
  account_number: z.string().trim().min(4).max(60),
  iban: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(300).optional(),
})

interface PayoutSuccessResponse {
  id: string
}

interface PayoutErrorResponse {
  error: string
}

export async function POST(request: Request): Promise<NextResponse<PayoutSuccessResponse | PayoutErrorResponse>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = payoutRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }

  const values = parsed.data

  // recipient_type is derived from the caller's actual role, never hardcoded and
  // never taken from the body. Hardcoding 'teacher' would silently mis-file every
  // seller payout the moment a seller withdrawal page starts using this route.
  // This doubles as the authorization check: only teachers and sellers earn payouts.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  const recipientType = profile?.role === "teacher" || profile?.role === "seller" ? profile.role : null
  if (!recipientType) {
    return NextResponse.json({ error: "Only teachers and sellers can request a payout" }, { status: 403 })
  }

  let encryptedAccountNumber: string
  let encryptedIban: string | null
  try {
    encryptedAccountNumber = encryptField(values.account_number)
    encryptedIban = values.iban ? encryptField(values.iban) : null
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Encryption is not configured on the server"
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // recipient_id is ALWAYS taken from the authenticated session — never from
  // the request body — so no caller can request a payout as another user.
  const { data, error } = await supabase
    .from("payouts")
    .insert({
      recipient_id: user.id,
      recipient_type: recipientType,
      amount: values.amount,
      currency: values.currency,
      payment_method: values.payment_method,
      bank_name: values.bank_name || null,
      account_number: encryptedAccountNumber,
      iban: encryptedIban,
      notes: values.notes || null,
    })
    .select("id")
    .maybeSingle()

  if (error) {
    // Surfaces the real reason (e.g. migration 007's balance-guard trigger
    // exception) to the UI instead of a generic 500.
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (!data) {
    return NextResponse.json({ error: "Withdrawal request was not created" }, { status: 400 })
  }

  return NextResponse.json({ id: data.id })
}
