import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { decryptField } from "@/lib/crypto/field-encryption"
import type { Payout } from "@/types/database"

/**
 * GET /api/admin/payouts/export?status=pending|processing|completed|failed|all
 *
 * CSV of withdrawal requests for the finance team. Account numbers are
 * decrypted server-side and ONLY the last 4 characters are ever emitted.
 */

const STATUSES = ["pending", "processing", "completed", "failed"] as const
const HEADERS = [
  "payout_id",
  "recipient_name",
  "recipient_email",
  "recipient_type",
  "amount",
  "currency",
  "payment_method",
  "bank_name",
  "account_title",
  "account_number_last4",
  "created_at",
] as const

/** Quotes a cell and neutralises spreadsheet formula injection. */
function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

function last4(stored: string | null): string {
  if (!stored) return ""
  let plain = ""
  try {
    plain = decryptField(stored)
  } catch {
    return ""
  }
  const compact = plain.replace(/\s+/g, "")
  return compact.length === 0 ? "" : compact.slice(-4)
}

export async function GET(request: Request) {
  const auth = await requireUser(["admin"])
  if (!auth.ok) return auth.response
  if (auth.user.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 })

  const status = new URL(request.url).searchParams.get("status") ?? "pending"
  if (status !== "all" && !(STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 400 })
  }

  const admin = createAdminClient()
  let query = admin.from("payouts").select("*").order("created_at", { ascending: true }).limit(5000)
  if (status !== "all") query = query.eq("status", status)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as Array<Payout & { account_title?: string | null }>
  const recipientIds = Array.from(new Set(rows.map((r) => r.recipient_id)))
  const { data: profiles } = recipientIds.length
    ? await admin.from("profiles").select("id, full_name, email").in("id", recipientIds)
    : { data: [] as Array<{ id: string; full_name: string | null; email: string | null }> }
  const byId = new Map((profiles ?? []).map((p: { id: string; full_name: string | null; email: string | null }) => [p.id, p]))

  const lines = [HEADERS.map(csvCell).join(",")]
  for (const r of rows) {
    const p = byId.get(r.recipient_id)
    lines.push(
      [
        r.id,
        p?.full_name ?? "",
        p?.email ?? "",
        r.recipient_type,
        r.amount,
        r.currency,
        r.payment_method ?? "",
        r.bank_name ?? "",
        r.account_title ?? "",
        last4(r.account_number),
        r.created_at ?? "",
      ]
        .map(csvCell)
        .join(",")
    )
  }

  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(lines.join("\r\n") + "\r\n", {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hayesh-payouts-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
