import type { Session, Transaction } from "@/types/database"

export interface WeekRange {
  start: Date
  end: Date
}

/** Monday-start week containing `now`, as a [start, end) range. */
export function currentWeekRange(now: Date = new Date()): WeekRange {
  const day = now.getDay() // 0=Sun .. 6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return { start, end }
}

/** Per-day session counts (Mon..Sun) for the current week, for a sparkline. */
export function sessionsPerDaySpark(sessions: Pick<Session, "scheduled_at">[], week: WeekRange): number[] {
  const counts = new Array(7).fill(0) as number[]
  for (const s of sessions) {
    if (!s.scheduled_at) continue
    const d = new Date(s.scheduled_at)
    if (d < week.start || d >= week.end) continue
    const dayIndex = Math.floor((d.getTime() - week.start.getTime()) / (24 * 60 * 60 * 1000))
    if (dayIndex >= 0 && dayIndex < 7) counts[dayIndex] += 1
  }
  return counts
}

/** Cumulative running total of completed-transaction net amounts, oldest to newest, for a sparkline. */
export function cumulativeEarningsSpark(completedTransactions: Transaction[], maxPoints = 10): number[] {
  const chronological = [...completedTransactions].sort((a, b) => {
    const ta = a.paid_at ?? a.created_at ?? ""
    const tb = b.paid_at ?? b.created_at ?? ""
    return ta.localeCompare(tb)
  })
  const running: number[] = []
  let total = 0
  for (const tx of chronological) {
    total += tx.net_amount || 0
    running.push(total)
  }
  return running.slice(-maxPoints)
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** Monthly-bucketed sum of completed net earnings for the trailing `months` calendar months, oldest first. */
export function monthlyEarnings(completedTransactions: Transaction[], months = 6): { label: string; amount: number }[] {
  const now = new Date()
  const buckets: { label: string; key: string; amount: number }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({ label: MONTH_LABELS[d.getMonth()], key: `${d.getFullYear()}-${d.getMonth()}`, amount: 0 })
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]))

  for (const tx of completedTransactions) {
    const dateStr = tx.paid_at ?? tx.created_at
    if (!dateStr) continue
    const d = new Date(dateStr)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    const bucket = byKey.get(key)
    if (bucket) bucket.amount += tx.net_amount || 0
  }

  return buckets.map(({ label, amount }) => ({ label, amount }))
}
