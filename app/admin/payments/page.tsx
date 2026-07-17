"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, DollarSign, Loader2, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatTile } from "@/components/dashboard/StatTile"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { Reveal } from "@/components/motion/Reveal"
import { useSupabase } from "@/hooks/useSupabase"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { StatusPill, statusToneFor, PAYOUT_STATUS_LABEL } from "@/components/teacher/StatusPill"
import { computeTeacherBalance } from "@/components/teacher/teacher-balance"
import type { Transaction, PaymentStatus, Payout, PayoutStatus, Profile } from "@/types/database"

const STATUS_BADGE: Record<PaymentStatus, "warning" | "secondary" | "success" | "destructive" | "outline"> = {
  pending: "warning",
  processing: "secondary",
  completed: "success",
  failed: "destructive",
  refunded: "outline",
}

type RecipientMap = Record<string, Pick<Profile, "full_name" | "email">>

export default function AdminPaymentsPage() {
  const { user } = useSupabase()

  // ── existing revenue / transactions state (unchanged) ──
  const [txs, setTxs] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  // ── withdrawal-requests queue state ──
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [recipients, setRecipients] = useState<RecipientMap>({})
  const [payoutsLoading, setPayoutsLoading] = useState(true)
  const [filter, setFilter] = useState<"pending" | "all">("pending")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectNotes, setRejectNotes] = useState("")
  const [queueError, setQueueError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data } = await supabase.from("transactions").select("*").order("created_at", { ascending: false })
      const all = (data || []) as Transaction[]
      setTxs(all)
      setTotal(all.filter((t) => t.status === "completed").reduce((s, t) => s + (t.gross_amount || 0), 0))
      setLoading(false)
    }
    load()
  }, [])

  const loadPayouts = useCallback(async () => {
    setPayoutsLoading(true)
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()

    const { data: payoutRows } = await supabase.from("payouts").select("*").order("created_at", { ascending: false })
    const rows = (payoutRows || []) as Payout[]
    setPayouts(rows)

    const recipientIds = Array.from(new Set(rows.map((p) => p.recipient_id)))
    if (recipientIds.length > 0) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", recipientIds)
      const map: RecipientMap = {}
      for (const p of (profileRows || []) as Pick<Profile, "id" | "full_name" | "email">[]) {
        map[p.id] = { full_name: p.full_name, email: p.email }
      }
      setRecipients(map)
    } else {
      setRecipients({})
    }
    setPayoutsLoading(false)
  }, [])

  useEffect(() => {
    loadPayouts()
  }, [loadPayouts])

  const platformFees = txs.filter((t) => t.status === "completed").reduce((s, t) => s + (t.platform_fee || 0), 0)
  const netPayouts = txs.filter((t) => t.status === "completed").reduce((s, t) => s + (t.net_amount || 0), 0)

  const visiblePayouts = useMemo(
    () => (filter === "pending" ? payouts.filter((p) => p.status === "pending" || p.status === "processing") : payouts),
    [payouts, filter]
  )
  const pendingCount = useMemo(() => payouts.filter((p) => p.status === "pending").length, [payouts])

  // Recipient's available balance, computed with the SAME formula the teacher
  // side uses (components/teacher/teacher-balance.ts), so an admin can sanity
  // check a payout request against real funds instead of trusting the amount
  // blindly. Batched: one pass over the already-loaded `txs` + `payouts`
  // arrays (no per-row query waterfall), keyed by recipient + currency since
  // balances don't mix currencies.
  const recipientAvailable = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of payouts) {
      const key = `${p.recipient_id}:${p.currency}`
      if (key in map) continue
      const recipientTx = txs.filter((t) => t.payee_id === p.recipient_id && t.currency === p.currency)
      const recipientPayouts = payouts.filter((pp) => pp.recipient_id === p.recipient_id && pp.currency === p.currency)
      map[key] = computeTeacherBalance(recipientTx, recipientPayouts).available
    }
    return map
  }, [txs, payouts])

  const updatePayoutStatus = async (
    payoutId: string,
    status: "processing" | "completed" | "failed",
    expectedStatus: PayoutStatus,
    notes?: string
  ) => {
    if (!user) return
    setBusyId(payoutId)
    setQueueError(null)
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      const isTerminal = status === "completed" || status === "failed"
      const { data, error } = await supabase
        .from("payouts")
        .update({
          status,
          processed_by: user.id,
          ...(isTerminal ? { processed_at: new Date().toISOString() } : {}),
          ...(notes ? { notes } : {}),
        })
        .eq("id", payoutId)
        .eq("status", expectedStatus) // optimistic concurrency guard
        .select()

      if (error) {
        setQueueError(error.message)
        return
      }
      if (!data || data.length === 0) {
        // Row didn't match expectedStatus — someone else already acted on it.
        setQueueError("This request was already processed by another admin.")
        await loadPayouts()
        return
      }
      if (status === "failed") {
        setRejectingId(null)
        setRejectNotes("")
      }
      await loadPayouts()
    } catch (e) {
      setQueueError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-8">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Admin / Payments</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-text-primary sm:text-3xl">Payments &amp; Revenue</h1>
      </Reveal>

      <PanelGroup title="Revenue Breakdown" className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Total Revenue" value={formatCurrency(total, "PKR")} accent />
        <StatTile label="Platform Fees" value={formatCurrency(platformFees, "PKR")} />
        <StatTile label="Net Payouts" value={formatCurrency(netPayouts, "PKR")} />
      </PanelGroup>

      <PanelGroup title="Withdrawal Requests">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-2">
              <button
                onClick={() => setFilter("pending")}
                className={`rounded-full border px-3 py-1 text-xs font-mono uppercase tracking-[0.08em] transition-colors ${
                  filter === "pending"
                    ? "border-accent-primary/50 bg-accent-primary/10 text-accent-primary"
                    : "border-border text-text-muted hover:text-text-primary"
                }`}
              >
                Needs Review {pendingCount > 0 && `(${pendingCount})`}
              </button>
              <button
                onClick={() => setFilter("all")}
                className={`rounded-full border px-3 py-1 text-xs font-mono uppercase tracking-[0.08em] transition-colors ${
                  filter === "all"
                    ? "border-accent-primary/50 bg-accent-primary/10 text-accent-primary"
                    : "border-border text-text-muted hover:text-text-primary"
                }`}
              >
                All
              </button>
            </div>
          </div>

          {queueError && <p className="text-sm text-accent-danger">{queueError}</p>}

          {payoutsLoading ? (
            <p className="font-mono text-sm text-text-muted">Loading…</p>
          ) : visiblePayouts.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-8 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-text-disabled" />
              <p className="mt-2 text-sm text-text-muted">
                {filter === "pending" ? "No withdrawal requests need review." : "No withdrawal requests yet."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-surface">
              <div className="min-w-[760px] divide-y divide-border">
                {visiblePayouts.map((p) => {
                  const recipient = recipients[p.recipient_id]
                  const isBusy = busyId === p.id
                  const isRejecting = rejectingId === p.id
                  const actionable = p.status === "pending" || p.status === "processing"
                  const expectedStatus: PayoutStatus = p.status ?? "pending"
                  const available = recipientAvailable[`${p.recipient_id}:${p.currency}`] ?? 0
                  const exceedsBalance = (p.amount || 0) > available

                  return (
                    <div key={p.id} className="px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text-primary">
                            {recipient?.full_name || "Unknown recipient"}
                            <span className="ml-2 font-mono text-xs capitalize text-text-muted">({p.recipient_type})</span>
                          </p>
                          <p className="truncate font-mono text-xs text-text-muted">{recipient?.email}</p>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-mono text-sm font-semibold tabular-nums text-text-primary">
                              {formatCurrency(p.amount || 0, p.currency === "USD" ? "USD" : "PKR")}
                            </p>
                            <p className="font-mono text-xs capitalize text-text-muted">{p.payment_method?.replace("_", " ") || "—"}</p>
                            <p className="font-mono text-xs tabular-nums text-text-muted">
                              Balance: {formatCurrency(available, p.currency === "USD" ? "USD" : "PKR")}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <StatusPill label={PAYOUT_STATUS_LABEL[p.status ?? "pending"] ?? "Pending"} tone={statusToneFor(p.status)} />
                            {exceedsBalance && (
                              <StatusPill
                                label="Exceeds Balance"
                                tone="warning"
                                className="inline-flex items-center gap-1"
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 grid gap-1 font-mono text-xs text-text-muted sm:grid-cols-3">
                        <span>Bank: {p.bank_name || "—"}</span>
                        <span>Account: {p.account_number || "—"}</span>
                        <span>Requested: {p.created_at ? formatDate(p.created_at) : "—"}</span>
                      </div>
                      {exceedsBalance && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-accent-warning">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          Requested amount exceeds this recipient&apos;s available balance — verify before approving.
                        </p>
                      )}
                      {p.notes && <p className="mt-1 text-xs text-text-muted">Notes: {p.notes}</p>}
                      {p.processed_at && (
                        <p className="mt-1 font-mono text-xs text-text-muted">
                          Processed {formatDate(p.processed_at)}
                        </p>
                      )}

                      {actionable && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {p.status === "pending" && (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={isBusy}
                              onClick={() => updatePayoutStatus(p.id, "processing", expectedStatus)}
                            >
                              {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                              Mark Processing
                            </Button>
                          )}
                          <Button
                            variant="aurora"
                            size="sm"
                            disabled={isBusy}
                            onClick={() => updatePayoutStatus(p.id, "completed", expectedStatus)}
                          >
                            {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approve &amp; Release
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={isBusy}
                            onClick={() => {
                              setRejectingId(isRejecting ? null : p.id)
                              setRejectNotes("")
                            }}
                          >
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </div>
                      )}

                      {isRejecting && (
                        <div className="mt-3 space-y-2 rounded-lg border border-accent-danger/30 bg-accent-danger/5 p-3">
                          <label htmlFor={`reject-notes-${p.id}`} className="font-mono text-xs uppercase tracking-[0.1em] text-text-muted">
                            Reason for rejection
                          </label>
                          <textarea
                            id={`reject-notes-${p.id}`}
                            value={rejectNotes}
                            onChange={(e) => setRejectNotes(e.target.value)}
                            rows={2}
                            placeholder="Explain why this request is being rejected"
                            className="flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={isBusy || !rejectNotes.trim()}
                              onClick={() => updatePayoutStatus(p.id, "failed", expectedStatus, rejectNotes.trim())}
                            >
                              {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                              Confirm Reject
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setRejectingId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </PanelGroup>

      {loading ? (
        <p className="font-mono text-sm text-text-muted">Loading…</p>
      ) : txs.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-12 text-center">
          <DollarSign className="mx-auto h-10 w-10 text-text-disabled" />
          <p className="mt-3 text-sm text-text-muted">No transactions yet</p>
        </div>
      ) : (
        <PanelGroup title="Transactions">
          <div className="hidden gap-4 border-b border-border px-4 pb-3 font-mono text-xs uppercase tracking-[0.12em] text-text-muted sm:grid sm:grid-cols-[1fr_140px_120px_140px]">
            <span>Type</span>
            <span>Date</span>
            <span>Status</span>
            <span className="text-right">Amount</span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <div className="min-w-[640px]">
              {txs.map((tx) => (
                <div
                  key={tx.id}
                  className="grid grid-cols-[1fr_140px_120px_140px] items-center gap-4 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-elevated"
                >
                  <p className="truncate text-sm capitalize text-text-primary">{tx.type.replace("_", " ")}</p>
                  <p className="font-mono text-xs tabular-nums text-text-muted">{tx.created_at ? formatDate(tx.created_at) : "—"}</p>
                  <Badge variant={tx.status ? STATUS_BADGE[tx.status] : "secondary"}>{tx.status || "unknown"}</Badge>
                  <span className="text-right font-mono text-sm font-semibold tabular-nums text-text-primary">{formatCurrency(tx.gross_amount || 0, "PKR")}</span>
                </div>
              ))}
            </div>
          </div>
        </PanelGroup>
      )}
    </div>
  )
}
