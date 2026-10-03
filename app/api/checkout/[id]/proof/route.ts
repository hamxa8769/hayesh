import { NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { notifyAdmins } from "@/lib/notifications"
import { rateLimit } from "@/lib/security/rate-limit"
import { formatCurrency } from "@/lib/utils/format"

/**
 * POST /api/checkout/[id]/proof
 *
 * Buyer submits proof for a manual payment (bank transfer / JazzCash /
 * Easypaisa). The transaction stays 'pending' with proof attached, which
 * puts it in the admin verification queue (/admin/payments).
 */

const proofSchema = z.object({
  payment_method: z.enum(["bank_transfer", "ibft", "jazzcash", "easypaisa"]),
  payer_reference: z.string().trim().min(4, "Enter the transaction ID from your bank or wallet").max(100),
  proof_path: z.string().trim().min(1, "Upload a screenshot of your payment").max(500),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid payment id" }, { status: 400 })

  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { user } = auth

  const limited = rateLimit(`proof:${user.userId}`, 10, 60_000)
  if (!limited.ok) return NextResponse.json({ error: "Too many attempts. Please wait a minute." }, { status: 429 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = proofSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })

  // The proof must live in the payer's own folder for THIS transaction —
  // storage RLS already restricts uploads to "<uid>/...", this pins the tx.
  const expectedPrefix = `${user.userId}/${id}/`
  if (!parsed.data.proof_path.startsWith(expectedPrefix) || parsed.data.proof_path.includes("..")) {
    return NextResponse.json({ error: "Invalid proof file" }, { status: 400 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data: updated, error } = await admin
    .from("transactions")
    .update({
      payment_method: parsed.data.payment_method,
      payer_reference: parsed.data.payer_reference,
      bank_transfer_proof: parsed.data.proof_path,
      proof_submitted_at: now,
      processor: "manual",
      rejection_reason: null,
      updated_at: now,
    })
    .eq("id", id)
    .eq("payer_id", user.userId)
    .eq("status", "pending")
    .select("id, reference_code, gross_amount, currency, description")
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated) return NextResponse.json({ error: "This payment can no longer be updated" }, { status: 409 })

  await notifyAdmins({
    type: "payment_submitted",
    title: "Payment awaiting verification",
    message: `${user.fullName} submitted ${formatCurrency(Number(updated.gross_amount), updated.currency === "USD" ? "USD" : "PKR")} (${updated.reference_code as string}) — ${updated.description as string}.`,
    actionUrl: "/admin/payments",
  })

  return NextResponse.json({ ok: true })
}
