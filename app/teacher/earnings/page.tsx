"use client"

import { useEffect, useState } from "react"
import { Wallet } from "lucide-react"
import { StatTile } from "@/components/dashboard/StatTile"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { Reveal } from "@/components/motion/Reveal"
import { cn } from "@/lib/utils/cn"
import { useSupabase } from "@/hooks/useSupabase"
import { formatPKR, formatDate } from "@/lib/utils/format"
import type { PaymentStatus, Transaction } from "@/types/database"

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  completed: { label: "Completed", className: "border-transparent bg-accent-success/20 text-accent-success" },
  pending: { label: "Pending", className: "border-transparent bg-accent-warning/20 text-accent-warning" },
  processing: { label: "Processing", className: "border-[#56B6FF]/30 bg-[#56B6FF]/10 text-[#56B6FF]" },
  failed: { label: "Failed", className: "border-transparent bg-accent-danger/20 text-accent-danger" },
  refunded: { label: "Refunded", className: "border-line-strong bg-surface-2 text-text-muted" },
}

function StatusPill({ status }: { status: PaymentStatus | null }) {
  const style = STATUS_STYLES[status ?? "pending"] ?? STATUS_STYLES.pending
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide",
        style.className
      )}
    >
      {style.label}
    </span>
  )
}

export default function EarningsPage() {
  const { user } = useSupabase()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data } = await supabase.from("transactions").select("*").eq("payee_id", user.id).order("created_at", { ascending: false })
      const txs = (data || []) as Transaction[]
      setTransactions(txs)
      setBalance(txs.filter((t) => t.status === "completed").reduce((s, t) => s + (t.net_amount || 0), 0))
      setLoading(false)
    }
    load()
  }, [user])

  return (
    <div className="space-y-6">
      <Reveal>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text-primary">Earnings</h2>
      </Reveal>

      <StatTile label="Available Balance" value={formatPKR(balance)} accent className="max-w-sm" />

      {loading ? (
        <p className="text-text-muted">Loading...</p>
      ) : transactions.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <Wallet className="mx-auto mb-3 h-12 w-12 text-text-disabled" />
          <p className="text-text-muted">No transactions yet</p>
        </div>
      ) : (
        <PanelGroup title="Transaction History">
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 font-mono text-xs font-normal uppercase tracking-[0.12em] text-text-muted">Type</th>
                  <th className="px-4 py-3 font-mono text-xs font-normal uppercase tracking-[0.12em] text-text-muted">Date</th>
                  <th className="px-4 py-3 font-mono text-xs font-normal uppercase tracking-[0.12em] text-text-muted">Status</th>
                  <th className="px-4 py-3 text-right font-mono text-xs font-normal uppercase tracking-[0.12em] text-text-muted">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border last:border-0 transition-colors hover:bg-surface-2">
                    <td className="px-4 py-3 capitalize text-text-primary">{tx.type.replace("_", " ")}</td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-text-muted">{tx.created_at ? formatDate(tx.created_at) : ""}</td>
                    <td className="px-4 py-3"><StatusPill status={tx.status} /></td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-accent-success">{formatPKR(tx.net_amount || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelGroup>
      )}
    </div>
  )
}
