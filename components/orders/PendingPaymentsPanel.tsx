"use client"

import Link from "next/link"
import { Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/teacher/StatusPill"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import {
  isUnderReview,
  transactionStatusMeta,
  type OrderTransaction,
} from "@/components/orders/order-status"

export interface PendingPaymentsPanelProps {
  transactions: OrderTransaction[]
}

/** Lists transactions that still need payment or are awaiting admin verification. */
export function PendingPaymentsPanel({ transactions }: PendingPaymentsPanelProps) {
  if (transactions.length === 0) return null

  return (
    <section className="space-y-3" aria-label="Pending payments">
      <h3 className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Pending Payments</h3>
      <ul className="space-y-2">
        {transactions.map((tx) => {
          const meta = transactionStatusMeta(tx)
          const review = isUnderReview(tx)
          const currency = tx.currency === "USD" ? "USD" : "PKR"
          return (
            <li
              key={tx.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent-warning/30 bg-surface-elevated/60 p-4"
            >
              <div className="flex min-w-0 items-start gap-3">
                <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-accent-warning" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">{tx.description ?? "Payment"}</p>
                  <p className="mt-0.5 font-mono text-xs tabular-nums text-text-muted">
                    {tx.reference_code ?? "—"}
                    {tx.created_at ? ` · ${formatDate(tx.created_at)}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold tabular-nums text-text-primary">
                  {formatCurrency(tx.gross_amount, currency)}
                </span>
                <StatusPill label={meta.label} tone={meta.tone} />
                <Button asChild variant={review ? "outline" : "aurora"} size="sm">
                  <Link href={`/checkout/${tx.id}`}>{review ? "View" : "Pay now"}</Link>
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
