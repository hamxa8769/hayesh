import { NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { markTransactionPaid, refundTransaction, rejectTransaction } from "@/lib/payments/settle"
import type { Transaction } from "@/types/database"

/**
 * /api/admin/transactions — manual payment verification queue.
 *
 * GET  → pending transactions that have proof attached, with a short-lived
 *        signed URL for each proof image and the payer's name/email.
 * POST → { transaction_id, action: 'confirm' | 'reject' | 'refund', reason? }
 */

export const maxDuration = 60

export interface VerificationQueueItem extends Transaction {
  payer_name: string | null
  payer_email: string | null
  proof_url: string | null
}

const PROOF_URL_TTL_SECONDS = 60 * 10

export async function GET() {
  const auth = await requireUser(["admin"])
  if (!auth.ok) return auth.response
  if (auth.user.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("transactions")
    .select("*")
    .eq("status", "pending")
    .not("bank_transfer_proof", "is", null)
    .order("proof_submitted_at", { ascending: true })
    .limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as Transaction[]
  const payerIds = Array.from(new Set(rows.map((r) => r.payer_id).filter((v): v is string => Boolean(v))))
  const { data: profiles } = payerIds.length
    ? await admin.from("profiles").select("id, full_name, email").in("id", payerIds)
    : { data: [] as Array<{ id: string; full_name: string; email: string }> }
  const byId = new Map((profiles ?? []).map((p: { id: string; full_name: string; email: string }) => [p.id, p]))

  const items: VerificationQueueItem[] = await Promise.all(
    rows.map(async (row) => {
      let proofUrl: string | null = null
      if (row.bank_transfer_proof) {
        const { data: signed } = await admin.storage.from("payment-proofs").createSignedUrl(row.bank_transfer_proof, PROOF_URL_TTL_SECONDS)
        proofUrl = signed?.signedUrl ?? null
      }
      const payer = row.payer_id ? byId.get(row.payer_id) : undefined
      return { ...row, payer_name: payer?.full_name ?? null, payer_email: payer?.email ?? null, proof_url: proofUrl }
    })
  )

  return NextResponse.json({ items })
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm"), transaction_id: z.string().uuid() }),
  z.object({
    action: z.literal("reject"),
    transaction_id: z.string().uuid(),
    reason: z.string().trim().min(3, "Give the customer a reason").max(500),
  }),
  z.object({
    action: z.literal("refund"),
    transaction_id: z.string().uuid(),
    reason: z.string().trim().min(3, "Give a reason for the refund").max(500),
  }),
])

export async function POST(request: Request) {
  const auth = await requireUser(["admin"])
  if (!auth.ok) return auth.response
  if (auth.user.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })

  const input = parsed.data
  if (input.action === "refund") {
    const refund = await refundTransaction(input.transaction_id, input.reason, auth.user.userId)
    if (!refund.ok) return NextResponse.json({ error: refund.error }, { status: refund.status })
    return NextResponse.json({ transaction: refund.transaction, already_settled: false })
  }
  const result =
    input.action === "confirm"
      ? await markTransactionPaid(input.transaction_id, { processor: "manual", confirmedBy: auth.user.userId })
      : await rejectTransaction(input.transaction_id, input.reason, auth.user.userId)

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 })
  return NextResponse.json({ transaction: result.transaction, already_settled: result.alreadySettled })
}
