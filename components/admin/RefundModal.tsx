"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils/format"
import type { Transaction } from "@/types/database"

export interface RefundModalProps {
  transaction: Transaction | null
  onClose: () => void
  onRefunded: () => void
}

export function RefundModal({ transaction, onClose, onRefunded }: RefundModalProps) {
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setReason("")
    setError(null)
  }, [transaction?.id])

  useEffect(() => {
    if (!transaction) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [transaction, submitting, onClose])

  if (!transaction) return null

  const trimmed = reason.trim()
  const currency = transaction.currency === "USD" ? "USD" : "PKR"

  const submit = async () => {
    if (trimmed.length < 3 || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refund", transaction_id: transaction.id, reason: trimmed }),
      })
      const json = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setError(json?.error ?? "Could not issue the refund")
        return
      }
      onRefunded()
      onClose()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !submitting && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="refund-modal-title"
        className="relative w-full max-w-md rounded-lg border border-line-strong bg-surface p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Refund</p>
            <h2 id="refund-modal-title" className="mt-1 font-display text-lg font-semibold text-text-primary">
              Refund {formatCurrency(transaction.gross_amount || 0, currency)}
            </h2>
            <p className="mt-0.5 font-mono text-xs text-text-muted">{transaction.reference_code ?? transaction.id}</p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="Close" className="text-text-muted hover:text-text-primary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 flex items-start gap-2 rounded-lg border border-accent-warning/30 bg-accent-warning/10 p-3 text-xs text-accent-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Return the money to the customer through the original payment channel.
        </p>

        <label htmlFor="refund-reason" className="mt-4 block font-mono text-xs uppercase tracking-[0.1em] text-text-muted">
          Reason
        </label>
        <textarea
          id="refund-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Why is this payment being refunded?"
          className="mt-1.5 flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
        />
        {error && (
          <p role="alert" className="mt-2 text-sm text-accent-danger">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={submit} disabled={submitting || trimmed.length < 3}>
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Issue refund
          </Button>
        </div>
      </div>
    </div>
  )
}
