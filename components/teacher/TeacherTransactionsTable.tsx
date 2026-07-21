import { Wallet } from "lucide-react"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { StatusPill, statusToneFor } from "@/components/teacher/StatusPill"
import { formatPKR, formatDate } from "@/lib/utils/format"
import type { Transaction } from "@/types/database"

export interface TeacherTransactionsTableProps {
  transactions: Transaction[]
  loading: boolean
}

export function TeacherTransactionsTable({ transactions, loading }: TeacherTransactionsTableProps) {
  if (loading) {
    return <p className="text-sm text-text-muted">Loading transactions...</p>
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <Wallet className="mx-auto mb-3 h-12 w-12 text-text-disabled" />
        <p className="text-text-muted">No transactions yet</p>
      </div>
    )
  }

  return (
    <PanelGroup title="Transaction History">
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 font-mono text-xs font-normal uppercase tracking-[0.12em] text-text-muted">Type</th>
              <th className="px-4 py-3 font-mono text-xs font-normal uppercase tracking-[0.12em] text-text-muted">Date</th>
              <th className="px-4 py-3 font-mono text-xs font-normal uppercase tracking-[0.12em] text-text-muted">Status</th>
              <th className="px-4 py-3 text-right font-mono text-xs font-normal uppercase tracking-[0.12em] text-text-muted">Net Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} className="border-b border-border last:border-0 transition-colors hover:bg-surface-elevated">
                <td className="px-4 py-3 capitalize text-text-primary">{tx.type.replace("_", " ")}</td>
                <td className="px-4 py-3 font-mono text-xs tabular-nums text-text-muted">
                  {tx.created_at ? formatDate(tx.created_at) : ""}
                </td>
                <td className="px-4 py-3">
                  <StatusPill label={tx.status ?? "pending"} tone={statusToneFor(tx.status)} className="capitalize" />
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-accent-success">
                  {formatPKR(tx.net_amount || 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelGroup>
  )
}
