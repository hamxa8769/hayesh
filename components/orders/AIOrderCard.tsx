"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, ChevronDown, Copy, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/teacher/StatusPill"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import {
  isAwaitingPayment,
  isPaid,
  isUnderReview,
  orderAmount,
  orderStatusMeta,
  postJson,
  type OrderTransaction,
} from "@/components/orders/order-status"
import type { AIOrder } from "@/types/database"

export interface AIOrderCardProps {
  order: AIOrder
  title: string
  transaction?: OrderTransaction
  onChanged: () => void | Promise<void>
}

export function AIOrderCard({ order, title, transaction, onChanged }: AIOrderCardProps) {
  const [open, setOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const status = order.status ?? "pending"
  const meta = orderStatusMeta(status)
  const amount = orderAmount(order)
  const awaiting = isAwaitingPayment(transaction)
  const canGenerate = status === "pending" && isPaid(transaction)

  const generate = async () => {
    setGenerating(true)
    setError(null)
    const res = await postJson("/api/ai-services/fulfill", { order_id: order.id })
    setGenerating(false)
    if (res.error) {
      setError(res.error)
      return
    }
    await onChanged()
    setOpen(true)
  }

  const copy = async () => {
    if (!order.ai_output) return
    try {
      await navigator.clipboard.writeText(order.ai_output)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setError("Could not copy to the clipboard.")
    }
  }

  return (
    <article className="rounded-lg border border-border bg-surface-elevated/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium text-text-primary">{title}</h3>
          <p className="mt-0.5 text-xs text-text-muted">
            Ordered{" "}
            <span className="font-mono tabular-nums text-text-primary">
              {order.created_at ? formatDate(order.created_at) : "—"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-semibold tabular-nums text-text-primary">
            {formatCurrency(amount.value, amount.currency)}
          </span>
          <StatusPill label={meta.label} tone={meta.tone} />
        </div>
      </div>

      {status === "pending" && transaction && awaiting && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {isUnderReview(transaction) ? (
            <>
              <StatusPill label="Payment under review" tone="info" />
              <Link href={`/checkout/${transaction.id}`} className="text-xs text-accent-secondary hover:underline">
                View payment
              </Link>
            </>
          ) : (
            <Button asChild variant="aurora" size="sm">
              <Link href={`/checkout/${transaction.id}`}>Complete payment</Link>
            </Button>
          )}
        </div>
      )}

      {canGenerate && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button type="button" variant="aurora" size="sm" onClick={generate} disabled={generating}>
            {generating && <Loader2 className="h-4 w-4 animate-spin" />}
            {generating ? "Generating…" : "Generate now"}
          </Button>
          {generating && <span className="text-xs text-text-muted">This can take up to a minute.</span>}
        </div>
      )}

      {status === "in_progress" && (
        <p className="mt-3 inline-flex items-center gap-2 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating…
        </p>
      )}

      {status === "completed" && order.ai_output && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-1.5 text-sm text-accent-secondary hover:underline"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            {open ? "Hide output" : "View output"}
          </button>
          {open && (
            <div className="mt-2 rounded-lg border border-border bg-surface">
              <div className="flex justify-end border-b border-border p-2">
                <Button type="button" variant="ghost" size="sm" onClick={copy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed text-text-primary">
                {order.ai_output}
              </pre>
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-accent-danger">
          {error}
        </p>
      )}
    </article>
  )
}
