import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { encryptField } from "@/lib/crypto/field-encryption"
import { payoutAccountSchema, updatePayoutAccountSchema } from "@/components/shared/payout-account-schema"
import type { PayoutAccountListItem, PayoutAccountValues } from "@/components/shared/payout-account-schema"

/**
 * /api/payout-accounts — a teacher's or seller's saved withdrawal account.
 *
 * Stored on public.payment_methods (migration 011) — see the storage-decision
 * comment in components/shared/payout-account-schema.ts for why. This route
 * exists (rather than a direct client insert) for the same reason
 * app/api/payouts/route.ts and app/api/payment-methods/route.ts do: bank
 * account numbers / IBANs must be AES-256-GCM encrypted server-side
 * (lib/crypto/field-encryption.ts — that module throws if imported
 * client-side) before they ever reach Postgres, and the decrypted value must
 * never be sent back to the browser.
 *
 * Uses the cookie-scoped server client, never the service-role client, so
 * migration 011's "Owner manages own payment methods" RLS policy stays the
 * real enforcement boundary — this route only adds the encryption step RLS
 * cannot perform and a role check, it does not widen what a user may write.
 */

interface ErrorResponse {
  error: string
}
interface ListResponse {
  accounts: PayoutAccountListItem[]
}
interface SaveResponse {
  account: PayoutAccountListItem
}
interface DeleteResponse {
  success: true
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>
type AuthResult = { userId: string } | { deny: NextResponse<ErrorResponse> }

/** 401 if signed out, 403 unless the caller's profile role is teacher or seller. */
async function authorizeCaller(supabase: SupabaseServerClient): Promise<AuthResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { deny: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()

  if (profile?.role !== "teacher" && profile?.role !== "seller") {
    return { deny: NextResponse.json({ error: "Only teachers and sellers can manage payout accounts" }, { status: 403 }) }
  }

  return { userId: user.id }
}

/** bank_name / account_title are non-sensitive routing labels — combined into the plaintext label column. */
function buildLabel(bankName?: string, accountTitle?: string): string | null {
  const parts = [accountTitle?.trim(), bankName?.trim()].filter((part): part is string => Boolean(part))
  return parts.length > 0 ? parts.join(" · ") : null
}

function encryptAccountDetails(values: PayoutAccountValues): { reference: string; last4: string } | { error: string } {
  try {
    const reference = encryptField(JSON.stringify({ account_number: values.account_number, iban: values.iban || null }))
    const last4Source = values.iban?.trim() || values.account_number
    return { reference, last4: last4Source.slice(-4) }
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Encryption is not configured on the server" }
  }
}

export async function GET(): Promise<NextResponse<ListResponse | ErrorResponse>> {
  const supabase = await createClient()
  const auth = await authorizeCaller(supabase)
  if ("deny" in auth) return auth.deny

  const { data, error } = await supabase
    .from("payment_methods")
    .select("id, method, label, account_last4, is_default, created_at")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ accounts: (data ?? []) as PayoutAccountListItem[] })
}

export async function POST(request: NextRequest): Promise<NextResponse<SaveResponse | ErrorResponse>> {
  const supabase = await createClient()
  const auth = await authorizeCaller(supabase)
  if ("deny" in auth) return auth.deny

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = payoutAccountSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }
  const values = parsed.data

  const encrypted = encryptAccountDetails(values)
  if ("error" in encrypted) {
    return NextResponse.json({ error: encrypted.error }, { status: 500 })
  }

  // Exactly one default per user: clear is_default on the caller's other
  // rows FIRST, scoped by user_id from the session (never the body).
  if (values.is_default) {
    const { error: clearError } = await supabase
      .from("payment_methods")
      .update({ is_default: false })
      .eq("user_id", auth.userId)
      .eq("is_default", true)
    if (clearError) {
      return NextResponse.json({ error: clearError.message }, { status: 400 })
    }
  }

  // user_id ALWAYS comes from the session — never the request body.
  const { data, error } = await supabase
    .from("payment_methods")
    .insert({
      user_id: auth.userId,
      method: values.payment_method,
      label: buildLabel(values.bank_name, values.account_title),
      account_last4: encrypted.last4,
      account_reference: encrypted.reference,
      is_default: values.is_default ?? false,
    })
    .select("id, method, label, account_last4, is_default, created_at")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (!data) {
    return NextResponse.json({ error: "Withdrawal account was not created" }, { status: 400 })
  }

  return NextResponse.json({ account: data as PayoutAccountListItem })
}

export async function PUT(request: NextRequest): Promise<NextResponse<SaveResponse | ErrorResponse>> {
  const supabase = await createClient()
  const auth = await authorizeCaller(supabase)
  if ("deny" in auth) return auth.deny

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = updatePayoutAccountSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }
  const values = parsed.data

  const encrypted = encryptAccountDetails(values)
  if ("error" in encrypted) {
    return NextResponse.json({ error: encrypted.error }, { status: 500 })
  }

  if (values.is_default) {
    const { error: clearError } = await supabase
      .from("payment_methods")
      .update({ is_default: false })
      .eq("user_id", auth.userId)
      .eq("is_default", true)
      .neq("id", values.id)
    if (clearError) {
      return NextResponse.json({ error: clearError.message }, { status: 400 })
    }
  }

  // Scoped by user_id from the session (belt-and-suspenders alongside RLS)
  // so a caller can only ever update their own saved account.
  const { data, error } = await supabase
    .from("payment_methods")
    .update({
      method: values.payment_method,
      label: buildLabel(values.bank_name, values.account_title),
      account_last4: encrypted.last4,
      account_reference: encrypted.reference,
      is_default: values.is_default ?? false,
    })
    .eq("id", values.id)
    .eq("user_id", auth.userId)
    .select("id, method, label, account_last4, is_default, created_at")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (!data) {
    return NextResponse.json({ error: "Withdrawal account not found" }, { status: 404 })
  }

  return NextResponse.json({ account: data as PayoutAccountListItem })
}

export async function DELETE(request: NextRequest): Promise<NextResponse<DeleteResponse | ErrorResponse>> {
  const supabase = await createClient()
  const auth = await authorizeCaller(supabase)
  if ("deny" in auth) return auth.deny

  const id = request.nextUrl.searchParams.get("id")
  const parsedId = z.string().uuid().safeParse(id)
  if (!parsedId.success) {
    return NextResponse.json({ error: "A valid account id is required" }, { status: 400 })
  }

  const { error, count } = await supabase
    .from("payment_methods")
    .delete({ count: "exact" })
    .eq("id", parsedId.data)
    .eq("user_id", auth.userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (!count) {
    return NextResponse.json({ error: "Withdrawal account not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
