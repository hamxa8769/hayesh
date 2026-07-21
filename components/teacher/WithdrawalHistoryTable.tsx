import { History } from "lucide-react"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { StatusPill, statusToneFor, PAYOUT_STATUS_LABEL } from "@/components/teacher/StatusPill"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import type { Payout } from "@/types/database"

export interface WithdrawalHistoryTableProps {
  payouts: Payout[]
  loading: boolean
}

export function WithdrawalHistoryTable({ payouts, loading }: WithdrawalHistoryTableProps) {
  if (loading) {
    return <p className="text-sm text-text-muted">Loading withdrawal history...</p>
  }

  if (payouts.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <History className="mx-auto mb-3 h-10 w-10 text-text-disabled" />
        <p className="text-text-muted">No withdrawal requests yet</p>
      </div>
    )
  }

  return (
    <PanelGroup title="Withdrawal History">
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 font-mono text-xs font-normal uppercase tracking-[0.12em] text-text-muted">Requested</th>
              <th className="px-4 py-3 font-mono text-xs font-normal uppercase tracking-[0.12em] text-text-muted">Method</th>
              <th className="px-4 py-3 font-mono text-xs font-normal uppercase tracking-[0.12em] text-text-muted">Status</th>
              <th className="px-4 py-3 font-mono text-xs font-normal uppercase tracking-[0.12em] text-text-muted">Released</th>
              <th className="px-4 py-3 text-right font-mono text-xs font-normal uppercase tracking-[0.12em] text-text-muted">Amount</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0 transition-colors hover:bg-surface-elevated">
                <td className="px-4 py-3 font-mono text-xs tabular-nums text-text-muted">
                  {p.created_at ? formatDate(p.created_at) : "—"}
                </td>
                <td className="px-4 py-3 capitalize text-text-primary">{p.payment_method?.replace("_", " ") || "—"}</td>
                <td className="px-4 py-3">
                  <StatusPill label={PAYOUT_STATUS_LABEL[p.status ?? "pending"] ?? "Pending"} tone={statusToneFor(p.status)} />
                </td>
                <td className="px-4 py-3 font-mono text-xs tabular-nums text-text-muted">
                  {p.processed_at ? formatDate(p.processed_at) : "—"}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-text-primary">
                  {formatCurrency(p.amount || 0, p.currency === "USD" ? "USD" : "PKR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelGroup>
  )
}
