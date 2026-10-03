import type { PillTone } from "@/components/teacher/StatusPill"
import type { Transaction } from "@/types/database"

/** Minimal transaction shape the order surfaces need. */
export type OrderTransaction = Pick<
  Transaction,
  | "id"
  | "status"
  | "gig_order_id"
  | "ai_order_id"
  | "gross_amount"
  | "currency"
  | "reference_code"
  | "description"
  | "proof_submitted_at"
  | "bank_transfer_proof"
  | "rejection_reason"
  | "created_at"
>

export const ORDER_TRANSACTION_COLUMNS =
  "id, status, gig_order_id, ai_order_id, gross_amount, currency, reference_code, description, proof_submitted_at, bank_transfer_proof, rejection_reason, created_at"

interface StatusMeta {
  label: string
  tone: PillTone
}

/** Order status (gig_orders.status / ai_orders.status) -> label + tone. */
export const ORDER_STATUS: Record<string, StatusMeta> = {
  pending: { label: "Awaiting payment", tone: "warning" },
  in_progress: { label: "In progress", tone: "info" },
  delivered: { label: "Delivered", tone: "info" },
  revision_requested: { label: "Revision requested", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  disputed: { label: "Disputed", tone: "danger" },
}

export function orderStatusMeta(status: string | null | undefined): StatusMeta {
  return ORDER_STATUS[status ?? "pending"] ?? { label: status ?? "Unknown", tone: "neutral" }
}

/** Transaction status -> label + tone, for payment history rows. */
export const TRANSACTION_STATUS: Record<string, StatusMeta> = {
  pending: { label: "Awaiting payment", tone: "warning" },
  processing: { label: "Paid (held)", tone: "info" },
  completed: { label: "Paid", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  refunded: { label: "Refunded", tone: "neutral" },
}

export function transactionStatusMeta(tx: Pick<OrderTransaction, "status" | "proof_submitted_at" | "bank_transfer_proof">): StatusMeta {
  if (tx.status === "pending" && isUnderReview(tx)) return { label: "Under review", tone: "info" }
  return TRANSACTION_STATUS[tx.status ?? "pending"] ?? { label: tx.status ?? "Unknown", tone: "neutral" }
}

/** Subscription status -> label + tone (parent payments). */
export const SUBSCRIPTION_STATUS: Record<string, StatusMeta> = {
  pending_payment: { label: "Awaiting payment", tone: "warning" },
  active: { label: "Active", tone: "success" },
  paused: { label: "Paused", tone: "warning" },
  past_due: { label: "Past due", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
}

export function subscriptionStatusMeta(status: string | null | undefined): StatusMeta {
  return SUBSCRIPTION_STATUS[status ?? ""] ?? { label: status ?? "Unknown", tone: "neutral" }
}

/** True when a pending transaction already has proof submitted (awaiting admin). */
export function isUnderReview(tx: Pick<OrderTransaction, "proof_submitted_at" | "bank_transfer_proof">): boolean {
  return Boolean(tx.proof_submitted_at || tx.bank_transfer_proof)
}

export function isAwaitingPayment(tx: Pick<OrderTransaction, "status"> | undefined): boolean {
  return tx?.status === "pending"
}

export function isPaid(tx: Pick<OrderTransaction, "status"> | undefined): boolean {
  return tx?.status === "completed" || tx?.status === "processing"
}

/** Index transactions by the order they pay for. */
export function indexTransactions(items: OrderTransaction[]): {
  byGig: Record<string, OrderTransaction>
  byAI: Record<string, OrderTransaction>
} {
  const byGig: Record<string, OrderTransaction> = {}
  const byAI: Record<string, OrderTransaction> = {}
  // items arrive newest first; keep the newest per order.
  for (const tx of items) {
    if (tx.gig_order_id && !byGig[tx.gig_order_id]) byGig[tx.gig_order_id] = tx
    if (tx.ai_order_id && !byAI[tx.ai_order_id]) byAI[tx.ai_order_id] = tx
  }
  return { byGig, byAI }
}

interface AmountFields {
  currency: string | null
  amount_pkr: number | null
  amount_usd: number | null
}

export function orderAmount(o: AmountFields): { value: number; currency: "PKR" | "USD" } {
  if (o.currency === "USD" && o.amount_usd != null) return { value: o.amount_usd, currency: "USD" }
  return { value: o.amount_pkr ?? 0, currency: "PKR" }
}

/** POST JSON and surface the API's `{ error }` message. */
export async function postJson<T = unknown>(
  url: string,
  body: Record<string, unknown>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const payload: unknown = await res.json().catch(() => null)
    if (!res.ok) {
      const message =
        payload && typeof payload === "object" && "error" in payload
          ? String((payload as { error: unknown }).error)
          : "Something went wrong. Please try again."
      return { data: null, error: message }
    }
    return { data: payload as T, error: null }
  } catch {
    return { data: null, error: "Could not reach the server. Check your connection and try again." }
  }
}
