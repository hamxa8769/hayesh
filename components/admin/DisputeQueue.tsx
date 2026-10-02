"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatDateTime } from "@/lib/utils/format"
import { cn } from "@/lib/utils/cn"
import type { GigOrder } from "@/types/database"

type DisputeItem = GigOrder & {
  buyer_name: string | null
  seller_name: string | null
}

type Resolution = "release" | "refund"

const MIN_NOTE = 3

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const json = (await res.json()) as { error?: string }
    return json.error ?? fallback
  } catch {
    return fallback
  }
}

function money(item: DisputeItem, value: number | null): string {
  if (value === null) return "—"
  return formatCurrency(value, item.currency === "USD" ? "USD" : "PKR")
}

export function DisputeQueue() {
  const [items, setItems] = useState<DisputeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [resolution, setResolution] = useState<Record<string, Resolution>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/disputes")
      if (!res.ok) throw new Error(await readError(res, "Could not load disputes"))
      const json = (await res.json()) as { items?: DisputeItem[] }
      setItems(json.items ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load disputes")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const resolve = async (item: DisputeItem) => {
    const choice = resolution[item.id]
    const note = (notes[item.id] ?? "").trim()
    if (!choice || note.length < MIN_NOTE) return
    setBusyId(item.id)
    setError(null)
    try {
      const res = await fetch("/api/admin/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: item.id, resolution: choice, note }),
      })
      if (!res.ok) throw new Error(await readError(res, "Could not resolve this dispute"))
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not resolve this dispute")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Badge variant={items.length > 0 ? "warning" : "secondary"}>{items.length} open</Badge>
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
            <div key={i} className="h-40 animate-pulse rounded-lg border border-border bg-surface" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-12 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-text-disabled" aria-hidden="true" />
          <p className="mt-3 text-sm text-text-muted">No open disputes</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => {
            const busy = busyId === item.id
            const choice = resolution[item.id]
            const note = notes[item.id] ?? ""
            const amount = item.currency === "USD" ? item.amount_usd : item.amount_pkr
            const canSubmit = !!choice && note.trim().length >= MIN_NOTE
            return (
              <li key={item.id} className="rounded-lg border border-border bg-surface p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-medium text-text-primary">{item.gig_title || "Untitled gig"}</h2>
                    <p className="mt-1 font-mono text-xs text-text-muted">
                      Buyer: <span className="text-text-primary">{item.buyer_name || "Unknown"}</span> · Seller:{" "}
                      <span className="text-text-primary">{item.seller_name || "Unknown"}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-lg font-semibold tabular-nums text-text-primary">{money(item, amount)}</p>
                    <p className="font-mono text-xs tabular-nums text-text-muted">
                      Seller payout: {money(item, item.seller_payout_amt)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3 text-sm">
                  <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/5 p-3">
                    <p className="font-mono text-xs uppercase tracking-[0.12em] text-accent-danger">
                      Dispute reason
                      {item.dispute_opened_at && (
                        <span className="ml-2 normal-case tracking-normal text-text-muted">
                          opened {formatDateTime(item.dispute_opened_at)}
                        </span>
                      )}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-text-primary">{item.dispute_reason || "No reason given"}</p>
                  </div>

                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Buyer requirements</p>
                    <p className="mt-1 whitespace-pre-wrap text-text-muted">{item.requirements || "—"}</p>
                  </div>

                  {(item.delivery_message || (item.delivery_files && item.delivery_files.length > 0)) && (
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Delivery</p>
                      {item.delivery_message && (
                        <p className="mt-1 whitespace-pre-wrap text-text-muted">{item.delivery_message}</p>
                      )}
                      {item.delivery_files && item.delivery_files.length > 0 && (
                        <ul className="mt-1 space-y-1">
                          {item.delivery_files.map((url, idx) => (
                            <li key={`${url}-${idx}`}>
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="break-all font-mono text-xs text-accent-secondary underline-offset-2 hover:underline"
                              >
                                File {idx + 1}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                <fieldset disabled={busy} className="mt-5 space-y-3 border-t border-border pt-4">
                  <legend className="sr-only">Resolve dispute</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        { value: "release", label: "Release to seller" },
                        { value: "refund", label: "Refund buyer" },
                      ] as const
                    ).map((opt) => (
                      <label
                        key={opt.value}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm text-text-primary transition-colors",
                          choice === opt.value ? "border-accent-primary/60 bg-accent-primary/10" : "border-border hover:border-line-strong"
                        )}
                      >
                        <input
                          type="radio"
                          name={`resolution-${item.id}`}
                          value={opt.value}
                          checked={choice === opt.value}
                          onChange={() => setResolution((prev) => ({ ...prev, [item.id]: opt.value }))}
                          className="h-4 w-4 accent-[color:var(--color-accent-primary)]"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  {choice === "refund" && (
                    <p className="text-xs text-accent-warning">
                      Marks the escrowed payment refunded — return the money to the buyer via the original channel.
                    </p>
                  )}
                  <div className="space-y-1.5">
                    <label
                      htmlFor={`note-${item.id}`}
                      className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted"
                    >
                      Resolution note
                    </label>
                    <textarea
                      id={`note-${item.id}`}
                      value={note}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      rows={2}
                      placeholder="Explain your decision (shared with both parties)"
                      className="flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                    />
                  </div>
                  <Button variant="aurora" size="sm" disabled={busy || !canSubmit} onClick={() => resolve(item)}>
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    Resolve dispute
                  </Button>
                </fieldset>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
