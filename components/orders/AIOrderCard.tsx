"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, ChevronDown, Copy, Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/teacher/StatusPill"
import { createClient } from "@/lib/supabase/client"
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
import type { AIOrder, AIRevisionEntry } from "@/types/database"

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
  const [revisionsAllowed, setRevisionsAllowed] = useState<number | null>(null)
  const [revising, setRevising] = useState(false)
  const [revisionOpen, setRevisionOpen] = useState(false)
  const [revisionText, setRevisionText] = useState("")
  const [historyOpen, setHistoryOpen] = useState(false)
  // Output / counters returned by a revision, shown until the parent refetches.
  const [revisedOutput, setRevisedOutput] = useState<string | null>(null)
  const [usedOverride, setUsedOverride] = useState(0)

  const status = order.status ?? "pending"
  const meta = orderStatusMeta(status)
  const amount = orderAmount(order)
  const awaiting = isAwaitingPayment(transaction)
  const canGenerate = status === "pending" && isPaid(transaction)

  const isCompleted = status === "completed"
  const serviceId = order.service_id

  useEffect(() => {
    if (!isCompleted) return
    let cancelled = false
    const loadAllowance = async () => {
      // Explicit columns only — system_prompt is never selectable by buyers.
      const { data } = await createClient().from("ai_services").select("id, revisions_allowed").eq("id", serviceId).maybeSingle()
      if (!cancelled) setRevisionsAllowed((data as { revisions_allowed: number | null } | null)?.revisions_allowed ?? 0)
    }
    void loadAllowance()
    return () => {
      cancelled = true
    }
  }, [isCompleted, serviceId])

  const output = revisedOutput ?? order.ai_output
  const baseUsed = order.revisions_used ?? 0
  const used = Math.max(baseUsed, usedOverride)
  const left = revisionsAllowed === null ? null : Math.max(revisionsAllowed - used, 0)
  const history: AIRevisionEntry[] = Array.isArray(order.revision_requests) ? order.revision_requests : []
  const pastVersions = history.filter((entry) => entry.response !== output)

  const submitRevision = async () => {
    const text = revisionText.trim()
    if (text.length < 5) {
      setError("Describe the changes you want (at least 5 characters).")
      return
    }
    setRevising(true)
    setError(null)
    const res = await postJson<{ output: string }>("/api/ai-services/revise", { order_id: order.id, request: text })
    setRevising(false)
    if (res.error || !res.data) {
      setError(res.error ?? "Revision failed. Please try again.")
      return
    }
    setRevisedOutput(res.data.output)
    setUsedOverride(used + 1)
    setRevisionText("")
    setRevisionOpen(false)
    setOpen(true)
    await onChanged()
  }

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
    if (!output) return
    try {
      await navigator.clipboard.writeText(output)
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

      {status === "completed" && output && (
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
                {output}
              </pre>
            </div>
          )}

          {left !== null && left > 0 && !revisionOpen && (
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setRevisionOpen(true)} disabled={revising}>
              <RotateCcw className="h-4 w-4" />
              Request revision ({used} of {revisionsAllowed} used, {left} left)
            </Button>
          )}
          {left === 0 && revisionsAllowed !== null && revisionsAllowed > 0 && (
            <p className="mt-3 text-xs text-text-muted">All {revisionsAllowed} included revisions have been used.</p>
          )}

          {revisionOpen && (
            <div className="mt-3 rounded-lg border border-border bg-surface p-3">
              <label htmlFor={`revision-${order.id}`} className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
                What should change?
              </label>
              <textarea
                id={`revision-${order.id}`}
                value={revisionText}
                onChange={(e) => setRevisionText(e.target.value)}
                rows={3}
                maxLength={2000}
                disabled={revising}
                placeholder="e.g. Make it shorter and more formal, and add a section on…"
                className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-accent-primary/60 focus:outline-none"
              />
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Button type="button" variant="aurora" size="sm" onClick={submitRevision} disabled={revising}>
                  {revising && <Loader2 className="h-4 w-4 animate-spin" />}
                  {revising ? "Revising…" : "Submit revision"}
                </Button>
                {!revising && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setRevisionOpen(false)}>
                    Cancel
                  </Button>
                )}
                {revising && <span className="text-xs text-text-muted">Revising… up to a minute</span>}
              </div>
            </div>
          )}

          {pastVersions.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                aria-expanded={historyOpen}
                className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
                Revision history ({pastVersions.length})
              </button>
              {historyOpen && (
                <ol className="mt-2 space-y-3">
                  {pastVersions.map((entry, i) => (
                    <li key={`${entry.timestamp}-${i}`} className="rounded-lg border border-border bg-surface p-3">
                      <p className="text-xs text-text-muted">
                        Request {i + 1}
                        {entry.timestamp ? ` · ${formatDate(entry.timestamp)}` : ""}: <span className="text-text-primary">{entry.request}</span>
                      </p>
                      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-text-muted">
                        {entry.response}
                      </pre>
                    </li>
                  ))}
                </ol>
              )}
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
