"use client"

import { useState } from "react"
import { StatusPill } from "@/components/teacher/StatusPill"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils/cn"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { orderAmount, orderStatusMeta, postJson } from "@/components/orders/order-status"
import { StarDisplay, useOrderReview } from "@/components/orders/GigReviewForm"
import { MessageOrderButton } from "@/components/messages/MessageOrderButton"
import { OrderActionModal, type OrderActionValues } from "@/components/orders/OrderActionModal"
import type { GigOrder, GigReview } from "@/types/database"

export interface SellerOrderCardProps {
  order: GigOrder
  onChanged: () => void | Promise<void>
}

type ModalKind = "deliver" | "dispute" | null

export function SellerOrderCard({ order, onChanged }: SellerOrderCardProps) {
  const [modal, setModal] = useState<ModalKind>(null)
  const [reply, setReply] = useState("")
  const [replying, setReplying] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)

  const status = order.status ?? "pending"
  const { review, setReview } = useOrderReview(order.id, status === "completed")
  const unpaid = status === "pending"
  const meta = unpaid ? { label: "Awaiting buyer payment", tone: "neutral" as const } : orderStatusMeta(status)
  const amount = orderAmount(order)
  const payout = order.seller_payout_amt
  const currency = amount.currency
  const due = order.delivery_due_at ? new Date(order.delivery_due_at) : null
  const isActive = status === "in_progress" || status === "revision_requested"
  const overdue = isActive && due !== null && due.getTime() < Date.now()
  const canMessage = status !== "pending" && status !== "cancelled"
  const canDeliver = isActive
  const canDispute = isActive || status === "delivered"
  const used = order.revisions_used ?? 0
  const allowed = order.revisions_allowed ?? 0

  const submit = async (action: "deliver" | "dispute", v: OrderActionValues): Promise<string | null> => {
    const body =
      action === "deliver"
        ? { action, message: v.text, files: v.files }
        : { action, reason: v.text }
    const res = await postJson(`/api/orders/gig/${order.id}`, body)
    if (res.error) return res.error
    await onChanged()
    return null
  }

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!review || reply.trim().length === 0) return
    setReplying(true)
    setReplyError(null)
    const res = await postJson<{ review: GigReview }>(`/api/gig-reviews/${review.id}/reply`, { reply: reply.trim() })
    setReplying(false)
    if (res.error || !res.data) {
      setReplyError(res.error ?? "Could not save your reply.")
      return
    }
    setReview(res.data.review)
    setReply("")
  }

  return (
    <article className={cn("rounded-lg border border-border bg-surface-elevated/60 p-4", unpaid && "opacity-60")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium text-text-primary">{order.gig_title ?? "Gig order"}</h3>
          <p className="mt-0.5 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
            {order.package_tier} package
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-mono text-sm font-semibold tabular-nums text-accent-success">
              {formatCurrency(payout ?? amount.value, currency)}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">Your payout</p>
          </div>
          <StatusPill label={meta.label} tone={meta.tone} />
        </div>
      </div>

      {order.requirements && (
        <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm text-text-muted">{order.requirements}</p>
      )}

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-text-muted">
        <div className="flex gap-1.5">
          <dt>Ordered</dt>
          <dd className="font-mono tabular-nums text-text-primary">{order.created_at ? formatDate(order.created_at) : "—"}</dd>
        </div>
        {due && (
          <div className="flex gap-1.5">
            <dt>Due</dt>
            <dd className={cn("font-mono tabular-nums", overdue ? "text-accent-danger" : "text-text-primary")}>
              {formatDate(due)}
              {overdue ? " · overdue" : ""}
            </dd>
          </div>
        )}
        <div className="flex gap-1.5">
          <dt>Revisions</dt>
          <dd className="font-mono tabular-nums text-text-primary">
            {used} of {allowed} used
          </dd>
        </div>
      </dl>

      {status === "revision_requested" && (
        <p className="mt-3 text-xs text-accent-warning">The buyer requested a revision. Deliver an updated version.</p>
      )}
      {status === "disputed" && order.dispute_reason && (
        <p className="mt-3 rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-3 text-sm text-text-primary">
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-accent-danger">Dispute reason</span>
          <br />
          {order.dispute_reason}
        </p>
      )}

      {status === "completed" && review && (
        <div className="mt-4 rounded-lg border border-border bg-surface p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
              Buyer review · {review.reviewer_name}
            </p>
            <StarDisplay rating={review.rating} />
          </div>
          {review.comment && <p className="mt-2 whitespace-pre-wrap text-sm text-text-primary">{review.comment}</p>}
          {review.status !== "published" && (
            <p className="mt-2 text-xs text-accent-warning">
              {review.status === "pending" ? "Awaiting admin approval — not public yet." : "Hidden by an admin."}
            </p>
          )}
          {review.seller_reply ? (
            <p className="mt-2 border-t border-border pt-2 text-sm text-text-muted">
              <span className="font-mono text-xs uppercase tracking-[0.12em]">Your reply</span>
              <br />
              {review.seller_reply}
            </p>
          ) : review.status !== "hidden" ? (
            <form onSubmit={sendReply} className="mt-3 space-y-2">
              <label htmlFor={`reply-${order.id}`} className="text-sm text-text-primary">
                Reply publicly
              </label>
              <textarea
                id={`reply-${order.id}`}
                rows={2}
                maxLength={1000}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Thank the buyer or address their feedback…"
                className="flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
              />
              {replyError && (
                <p role="alert" className="text-sm text-accent-danger">
                  {replyError}
                </p>
              )}
              <div className="flex justify-end">
                <Button type="submit" variant="outline" size="sm" disabled={replying || reply.trim().length === 0}>
                  Reply
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      )}

      {(canDeliver || canDispute || canMessage) && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {canMessage && <MessageOrderButton orderId={order.id} label="Message buyer" />}
          {canDispute && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setModal("dispute")}>
              Open dispute
            </Button>
          )}
          {canDeliver && (
            <Button type="button" variant="aurora" size="sm" onClick={() => setModal("deliver")}>
              Deliver
            </Button>
          )}
        </div>
      )}

      <OrderActionModal
        open={modal === "deliver"}
        title="Deliver order"
        description="Describe what you are delivering. Add links to any files (Drive, Dropbox, etc.)."
        textLabel="Delivery message"
        textPlaceholder="Here is your finished work…"
        minLength={5}
        withFiles
        submitLabel="Deliver"
        onClose={() => setModal(null)}
        onSubmit={(v) => submit("deliver", v)}
      />
      <OrderActionModal
        open={modal === "dispute"}
        title="Open a dispute"
        description="An admin will review the order and decide whether to release or refund the payment."
        textLabel="Reason"
        textPlaceholder="Explain the problem (at least 10 characters)…"
        minLength={10}
        destructive
        submitLabel="Open dispute"
        onClose={() => setModal(null)}
        onSubmit={(v) => submit("dispute", v)}
      />
    </article>
  )
}
