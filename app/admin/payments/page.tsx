"use client"

import { useEffect, useState } from "react"
import { DollarSign } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { StatTile } from "@/components/dashboard/StatTile"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { Reveal } from "@/components/motion/Reveal"
import { formatPKR, formatDate } from "@/lib/utils/format"
import type { Transaction, PaymentStatus } from "@/types/database"

const STATUS_BADGE: Record<PaymentStatus, "warning" | "secondary" | "success" | "destructive" | "outline"> = {
  pending: "warning",
  processing: "secondary",
  completed: "success",
  failed: "destructive",
  refunded: "outline",
}

export default function AdminPaymentsPage() {
  const [txs, setTxs] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

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

  const platformFees = txs.filter((t) => t.status === "completed").reduce((s, t) => s + (t.platform_fee || 0), 0)
  const netPayouts = txs.filter((t) => t.status === "completed").reduce((s, t) => s + (t.net_amount || 0), 0)

  return (
    <div className="space-y-8">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Admin / Payments</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-text-primary sm:text-3xl">Payments &amp; Revenue</h1>
      </Reveal>

      <PanelGroup title="Revenue Breakdown" className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Total Revenue" value={formatPKR(total)} accent />
        <StatTile label="Platform Fees" value={formatPKR(platformFees)} />
        <StatTile label="Net Payouts" value={formatPKR(netPayouts)} />
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
                  <span className="text-right font-mono text-sm font-semibold tabular-nums text-text-primary">{formatPKR(tx.gross_amount || 0)}</span>
                </div>
              ))}
            </div>
          </div>
        </PanelGroup>
      )}
    </div>
  )
}
