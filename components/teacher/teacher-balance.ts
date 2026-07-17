import type { Payout, Transaction } from "@/types/database"

/**
 * Escrow-aware balance breakdown for a teacher.
 *
 * Model (see supabase-migrations/006-core-rls-policies.sql):
 *   - `transactions` are money taken from a parent and HELD by Hayesh.
 *     A transaction becomes the teacher's money once `status = 'completed'`.
 *   - `payouts` are a release of held funds to the teacher, always reviewed
 *     by an admin. `status` moves pending -> processing -> completed, or
 *     -> failed if rejected (failed payouts do not consume held funds).
 */
export interface TeacherBalance {
  /** Sum of net_amount for all completed transactions payable to this teacher. */
  totalEarned: number
  /** Funds Hayesh is currently holding that have not yet been paid out (totalEarned - withdrawn). */
  inEscrow: number
  /** Funds not yet claimed by any non-failed payout request — safe to request a new withdrawal up to this amount. */
  available: number
  /** Sum of payouts that have actually been released (status = 'completed'). */
  withdrawn: number
  /** Sum of payouts currently awaiting admin action (pending or processing). */
  pendingPayouts: number
}

export function computeTeacherBalance(transactions: Transaction[], payouts: Payout[]): TeacherBalance {
  const totalEarned = transactions
    .filter((t) => t.status === "completed")
    .reduce((sum, t) => sum + (t.net_amount || 0), 0)

  const withdrawn = payouts
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + (p.amount || 0), 0)

  const pendingPayouts = payouts
    .filter((p) => p.status === "pending" || p.status === "processing")
    .reduce((sum, p) => sum + (p.amount || 0), 0)

  const claimed = withdrawn + pendingPayouts
  const available = Math.max(0, totalEarned - claimed)
  const inEscrow = Math.max(0, totalEarned - withdrawn)

  return { totalEarned, inEscrow, available, withdrawn, pendingPayouts }
}
