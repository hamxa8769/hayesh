import { ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { formatPKR } from "@/lib/utils/format"
import type { TeacherBalance } from "@/components/teacher/teacher-balance"

export interface EscrowBalanceCardProps {
  balance: TeacherBalance
  className?: string
}

export function EscrowBalanceCard({ balance, className }: EscrowBalanceCardProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg border border-border bg-surface p-6", className)}>
      <span aria-hidden="true" className="aurora-bg absolute inset-x-0 top-0 h-[2px]" />

      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-primary" />
        <div>
          <h3 className="font-display text-base font-semibold text-text-primary">Escrow Protection</h3>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            Every payment from a parent is held by Hayesh, not sent to you directly. Funds move to{" "}
            <span className="text-text-primary">available to withdraw</span> once a session&apos;s payment settles, and
            are released to your bank only after an admin approves your withdrawal request.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface-elevated p-4">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">In Escrow</p>
          <p className="mt-2 font-display text-xl font-semibold tabular-nums text-text-primary">
            {formatPKR(balance.inEscrow)}
          </p>
          <p className="mt-1 text-xs text-text-muted">Held by Hayesh, not yet paid out</p>
        </div>
        <div className="rounded-lg border border-accent-primary/30 bg-surface-elevated p-4">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Available to Withdraw</p>
          <p className="mt-2 font-display text-xl font-semibold tabular-nums text-accent-primary">
            {formatPKR(balance.available)}
          </p>
          <p className="mt-1 text-xs text-text-muted">Not yet claimed by a request</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-elevated p-4">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Withdrawn</p>
          <p className="mt-2 font-display text-xl font-semibold tabular-nums text-text-primary">
            {formatPKR(balance.withdrawn)}
          </p>
          <p className="mt-1 text-xs text-text-muted">Released to your account to date</p>
        </div>
      </div>

      {balance.pendingPayouts > 0 && (
        <p className="mt-4 font-mono text-xs text-accent-warning">
          {formatPKR(balance.pendingPayouts)} is in a pending withdrawal request awaiting admin review.
        </p>
      )}
    </div>
  )
}
