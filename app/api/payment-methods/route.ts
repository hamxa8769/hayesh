import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { encryptField } from "@/lib/crypto/field-encryption"
import type { PaymentMethodListItem } from "@/components/parent/payment-schema"

/**
 * /api/payment-methods — a user's saved payment instruments (public.payment_methods,
 * migration 011).
 *
 * This MUST be a server route, not a direct client insert, for one reason:
 * account_reference has to be encrypted (AES-256-GCM, lib/crypto/field-encryption.ts)
 * before it reaches Postgres, and that module throws if imported client-side.
 * The route also derives account_last4 server-side so the client never has to
 * be trusted to compute it correctly, and never returns the encrypted value
 * back to the caller.
 *
 * Uses the cookie-scoped server client (not the service-role client) so
 * migration 011's "Owner manages own payment methods" RLS policy stays the
 * real enforcement boundary — this route only adds the encryption step RLS
 * cannot perform, it does not widen what a user may write.
 */

const PAYMENT_METHOD_ENUM = ["stripe", "jazzcash", "easypaisa", "ibft", "bank_transfer", "card_pk"] as const

const createSchema = z.object({
  method: z.enum(PAYMENT_METHOD_ENUM, { error: "Invalid payment method" }),
  label: z.string().trim().max(60, "Keep the label under 60 characters").optional(),
  // Plaintext (migration 014): the account holder's name must be readable by an
  // admin reconciling a transfer, so unlike account_reference it is NOT encrypted.
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
  is_default: z.boolean().optional().default(false),
})

interface CreateSuccessResponse {
  paymentMethod: PaymentMethodListItem
}

interface ErrorResponse {
  error: string
}

interface DeleteSuccessResponse {
  success: true
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<CreateSuccessResponse | ErrorResponse>> {
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

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }

  const values = parsed.data

  // account_last4 is ALWAYS derived here, server-side, from the raw value —
  // never trusted from the client — so it can be displayed safely without
  // ever decrypting account_reference again.
  const accountLast4 = values.account_reference.slice(-4)

  let encryptedReference: string
  try {
    encryptedReference = encryptField(values.account_reference)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Encryption is not configured on the server"
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // Exactly one default per user: clear is_default on the caller's other
  // rows FIRST, scoped by user_id from the session (never the body), before
  // inserting the new row.
  if (values.is_default) {
    const { error: clearError } = await supabase
      .from("payment_methods")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .eq("is_default", true)

    if (clearError) {
      return NextResponse.json({ error: clearError.message }, { status: 400 })
    }
  }

  // user_id ALWAYS comes from the session — never the request body — so no
  // caller can save a payment method under another user's account.
  const { data, error } = await supabase
    .from("payment_methods")
    .insert({
      user_id: user.id,
      method: values.method,
      label: values.label || null,
      account_holder_name: values.account_holder_name,
      account_last4: accountLast4,
      account_reference: encryptedReference,
      is_default: values.is_default,
    })
    .select("id, method, label, account_holder_name, account_last4, is_default, created_at")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (!data) {
    return NextResponse.json({ error: "Payment method was not created" }, { status: 400 })
  }

  return NextResponse.json({ paymentMethod: data as PaymentMethodListItem })
}

export async function DELETE(
  request: NextRequest,
): Promise<NextResponse<DeleteSuccessResponse | ErrorResponse>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const id = request.nextUrl.searchParams.get("id")
  const parsedId = z.string().uuid().safeParse(id)
  if (!parsedId.success) {
    return NextResponse.json({ error: "A valid payment method id is required" }, { status: 400 })
  }

  // Scoped by user_id from the session (belt-and-suspenders alongside RLS'
  // "Owner manages own payment methods" policy) so a caller can only ever
  // delete their own saved payment method.
  const { error, count } = await supabase
    .from("payment_methods")
    .delete({ count: "exact" })
    .eq("id", parsedId.data)
    .eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (!count) {
    return NextResponse.json({ error: "Payment method not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
