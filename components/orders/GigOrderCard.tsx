"use client"

import { useState } from "react"
import Link from "next/link"
import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/teacher/StatusPill"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import {
  isAwaitingPayment,
  isUnderReview,
  orderAmount,
  orderStatusMeta,
  postJson,
  type OrderTransaction,
} from "@/components/orders/order-status"
import { OrderActionModal, type OrderActionValues } from "@/components/orders/OrderActionModal"
import type { GigOrder } from "@/types/database"

export interface GigOrderCardProps {
  order: GigOrder
  transaction?: OrderTransaction
  onChanged: () => void | Promise<void>
}

type ModalKind = "revision" | "dispute" | null

export function GigOrderCard({ order, transaction, onChanged }: GigOrderCardProps) {
  const [modal, setModal] = useState<ModalKind>(null)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const status = order.status ?? "pending"
  const meta = orderStatusMeta(status)
  const amount = orderAmount(order)
  const used = order.revisions_used ?? 0
  const allowed = order.revisions_allowed ?? 0
  const revisionsLeft = used < allowed
  const canDispute = status === "in_progress" || status === "revision_requested" || status === "delivered"
  const awaiting = status === "pending" && isAwaitingPayment(transaction)
  const files = order.delivery_files ?? []

  const accept = async () => {
    setAccepting(true)
    setError(null)
    const res = await postJson(`/api/orders/gig/${order.id}`, { action: "accept" })
    setAccepting(false)
    if (res.error) {
      setError(res.error)
      return
    }
    await onChanged()
  }

  const runAction = async (action: "revision" | "dispute", values: OrderActionValues): Promise<string | null> => {
    const body = action === "revision" ? { action, message: values.text } : { action, reason: values.text }
    const res = await postJson(`/api/orders/gig/${order.id}`, body)
    if (res.error) return res.error
    await onChanged()
    return null
  }

  return (
    <article className="rounded-lg border border-border bg-surface-elevated/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium text-text-primary">{order.gig_title ?? "Service order"}</h3>
          <p className="mt-0.5 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
            {order.package_tier} package
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-semibold tabular-nums text-text-primary">
            {formatCurrency(amount.value, amount.currency)}
          </span>
          <StatusPill label={meta.label} tone={meta.tone} />
        </div>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-text-muted">
        <div className="flex gap-1.5">
          <dt>Ordered</dt>
          <dd className="font-mono tabular-nums text-text-primary">{order.created_at ? formatDate(order.created_at) : "—"}</dd>
        </div>
        {order.delivery_due_at && (
          <div className="flex gap-1.5">
            <dt>Due</dt>
            <dd className="font-mono tabular-nums text-text-primary">{formatDate(order.delivery_due_at)}</dd>
          </div>
        )}
        {order.delivered_at && (
          <div className="flex gap-1.5">
            <dt>Delivered</dt>
            <dd className="font-mono tabular-nums text-text-primary">{formatDate(order.delivered_at)}</dd>
          </div>
        )}
      </dl>

      {status === "pending" && transaction && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {awaiting && isUnderReview(transaction) ? (
            <>
              <StatusPill label="Payment under review" tone="info" />
              <Link href={`/checkout/${transaction.id}`} className="text-xs text-accent-secondary hover:underline">
                View payment
              </Link>
            </>
          ) : awaiting ? (
            <Button asChild variant="aurora" size="sm">
              <Link href={`/checkout/${transaction.id}`}>Complete payment</Link>
            </Button>
          ) : transaction.status === "failed" ? (
            <p className="text-xs text-accent-danger">
              Payment failed{transaction.rejection_reason ? `: ${transaction.rejection_reason}` : "."}
            </p>
          ) : null}
        </div>
      )}

      {status === "delivered" && (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-3">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Delivery</p>
          {order.delivery_message && (
            <p className="whitespace-pre-wrap text-sm text-text-primary">{order.delivery_message}</p>
          )}
          {files.length > 0 && (
            <ul className="space-y-1">
              {files.map((url, i) => (
                <li key={`${url}-${i}`}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 break-all text-sm text-accent-secondary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="button" variant="aurora" size="sm" onClick={accept} disabled={accepting}>
              {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Accept delivery
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!revisionsLeft || accepting}
              onClick={() => setModal("revision")}
            >
              Request revision
            </Button>
            <span className="font-mono text-xs tabular-nums text-text-muted">
              {used} of {allowed} revisions used
            </span>
          </div>
        </div>
      )}

      {status === "disputed" && (
        <p className="mt-3 rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-3 text-sm text-text-primary">
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-accent-danger">Dispute reason</span>
          <br />
          {order.dispute_reason ?? "Under review by an admin."}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-accent-danger">
          {error}
        </p>
      )}

      {canDispute && (
        <div className="mt-3 flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={() => setModal("dispute")}>
            Open dispute
          </Button>
        </div>
      )}

      <OrderActionModal
        open={modal === "revision"}
        title="Request a revision"
        description={`Tell the seller what needs to change. ${used} of ${allowed} revisions used.`}
        textLabel="What should be changed?"
        textPlaceholder="Describe the changes you need…"
        minLength={5}
        submitLabel="Send request"
        onClose={() => setModal(null)}
        onSubmit={(v) => runAction("revision", v)}
      />
      <OrderActionModal
        open={modal === "dispute"}
        title="Open a dispute"
        description="An admin will review the order and decide whether to release or refund the payment."
        textLabel="Reason"
        textPlaceholder="Explain what went wrong (at least 10 characters)…"
        minLength={10}
        destructive
        submitLabel="Open dispute"
        onClose={() => setModal(null)}
        onSubmit={(v) => runAction("dispute", v)}
      />
    </article>
  )
}
