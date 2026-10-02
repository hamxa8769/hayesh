"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, FileText, Loader2, RefreshCw, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { formatCurrency, formatDateTime } from "@/lib/utils/format"
import type { Transaction } from "@/types/database"

type QueueItem = Transaction & {
  payer_name: string | null
  payer_email: string | null
  proof_url: string | null
}

const METHOD_LABEL: Record<string, string> = {
  bank_transfer: "Bank transfer",
  ibft: "IBFT / Raast",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
}

const MIN_REASON = 3

function isPdf(item: QueueItem): boolean {
  const path = (item.bank_transfer_proof ?? item.proof_url ?? "").split("?")[0].toLowerCase()
  return path.endsWith(".pdf")
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const json = (await res.json()) as { error?: string }
    return json.error ?? fallback
  } catch {
    return fallback
  }
}

export function PaymentVerificationQueue() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [reason, setReason] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/transactions")
      if (!res.ok) throw new Error(await readError(res, "Could not load pending payments"))
      const json = (await res.json()) as { items?: QueueItem[] }
      setItems(json.items ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load pending payments")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const act = async (
    id: string,
    body: { action: "confirm"; transaction_id: string } | { action: "reject"; transaction_id: string; reason: string }
  ) => {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch("/api/admin/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await readError(res, "Action failed. Please try again."))
      setItems((prev) => prev.filter((i) => i.id !== id))
      if (rejectingId === id) {
        setRejectingId(null)
        setReason("")
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed. Please try again.")
    } finally {
      setBusyId(null)
    }
  }

  const confirmPayment = (item: QueueItem) => {
    const ok = window.confirm(
      `Confirm receipt of ${formatCurrency(item.gross_amount, item.currency === "USD" ? "USD" : "PKR")} from ${
        item.payer_name || item.payer_email || "this payer"
      }? This will activate the order immediately.`
    )
    if (!ok) return
    void act(item.id, { action: "confirm", transaction_id: item.id })
  }

  return (
    <PanelGroup title="Payments awaiting verification">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Badge variant={items.length > 0 ? "warning" : "secondary"}>
            {items.length} pending
          </Badge>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} aria-hidden="true" />
            Refresh
          </Button>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-sm text-accent-danger">
            {error}
          </p>
        )}

        {loading && items.length === 0 ? (
          <div className="space-y-3" aria-busy="true">
            {[0, 1].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-lg border border-border bg-surface" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-text-disabled" aria-hidden="true" />
            <p className="mt-2 text-sm text-text-muted">No payments waiting for verification</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const busy = busyId === item.id
              const rejecting = rejectingId === item.id
              const currency = item.currency === "USD" ? "USD" : "PKR"
              const pdf = isPdf(item)
              return (
                <li key={item.id} className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div>
                        <p className="truncate text-sm font-medium text-text-primary">
                          {item.payer_name || "Unknown payer"}
                        </p>
                        <p className="truncate font-mono text-xs text-text-muted">{item.payer_email || "—"}</p>
                      </div>
                      <p className="text-sm text-text-muted">{item.description || "No description"}</p>
                      <dl className="grid gap-x-6 gap-y-1 font-mono text-xs text-text-muted sm:grid-cols-2">
                        <div className="flex gap-1.5">
                          <dt>Type:</dt>
                          <dd className="capitalize text-text-primary">{item.type.replace("_", " ")}</dd>
                        </div>
                        <div className="flex gap-1.5">
                          <dt>Method:</dt>
                          <dd className="text-text-primary">
                            {item.payment_method ? METHOD_LABEL[item.payment_method] ?? item.payment_method : "—"}
                          </dd>
                        </div>
                        <div className="flex gap-1.5">
                          <dt>Ref:</dt>
                          <dd className="break-all text-text-primary">{item.reference_code || "—"}</dd>
                        </div>
                        <div className="flex gap-1.5">
                          <dt>Customer TID:</dt>
                          <dd className="break-all text-text-primary">{item.payer_reference || "—"}</dd>
                        </div>
                        <div className="flex gap-1.5 sm:col-span-2">
                          <dt>Submitted:</dt>
                          <dd className="tabular-nums text-text-primary">
                            {item.proof_submitted_at ? formatDateTime(item.proof_submitted_at) : "—"}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="flex shrink-0 flex-row items-start justify-between gap-4 sm:flex-col sm:items-end">
                      <p className="font-mono text-lg font-semibold tabular-nums text-text-primary">
                        {formatCurrency(item.gross_amount, currency)}
                      </p>
                      {item.proof_url ? (
                        pdf ? (
                          <a
                            href={item.proof_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-colors hover:border-line-strong"
                          >
                            <FileText className="h-4 w-4" aria-hidden="true" /> Open PDF
                          </a>
                        ) : (
                          <a href={item.proof_url} target="_blank" rel="noopener noreferrer" aria-label="Open proof image in a new tab">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.proof_url}
                              alt="Payment proof"
                              className="h-24 w-24 rounded-lg border border-border object-cover"
                            />
                          </a>
                        )
                      ) : (
                        <span className="font-mono text-xs text-accent-warning">No proof attached</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button variant="aurora" size="sm" disabled={busy} onClick={() => confirmPayment(item)}>
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      Confirm payment
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setRejectingId(rejecting ? null : item.id)
                        setReason("")
                      }}
                    >
                      <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> Reject
                    </Button>
                  </div>

                  {rejecting && (
                    <div className="mt-3 space-y-2 rounded-lg border border-accent-danger/30 bg-accent-danger/5 p-3">
                      <label
                        htmlFor={`reject-${item.id}`}
                        className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted"
                      >
                        Reason for rejection
                      </label>
                      <textarea
                        id={`reject-${item.id}`}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={2}
                        placeholder="Tell the payer why this payment was rejected"
                        className="flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={busy || reason.trim().length < MIN_REASON}
                          onClick={() => act(item.id, { action: "reject", transaction_id: item.id, reason: reason.trim() })}
                        >
                          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                          Confirm reject
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setRejectingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </PanelGroup>
  )
}
