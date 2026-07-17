import { cn } from "@/lib/utils/cn"

export type PillTone = "success" | "warning" | "info" | "danger" | "neutral"

export interface StatusPillProps {
  label: string
  tone: PillTone
  className?: string
}

const TONE_STYLES: Record<PillTone, string> = {
  success: "border-transparent bg-accent-success/20 text-accent-success",
  warning: "border-transparent bg-accent-warning/20 text-accent-warning",
  info: "border-[#56B6FF]/30 bg-[#56B6FF]/10 text-[#56B6FF]",
  danger: "border-transparent bg-accent-danger/20 text-accent-danger",
  neutral: "border-line-strong bg-surface-2 text-text-muted",
}

/** Maps `transactions.status` (PaymentStatus) and `payouts.status` (PayoutStatus) to a semantic tone. */
const STATUS_TONE: Record<string, PillTone> = {
  completed: "success",
  processing: "info",
  pending: "warning",
  failed: "danger",
  refunded: "neutral",
}

export function StatusPill({ label, tone, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide",
        TONE_STYLES[tone],
        className
      )}
    >
      {label}
    </span>
  )
}

export function statusToneFor(status: string | null | undefined): PillTone {
  return STATUS_TONE[status ?? "pending"] ?? "neutral"
}

/**
 * Maps `payouts.status` (PayoutStatus) to its display label. Shared by the
 * admin withdrawal queue and the teacher withdrawal history table so the
 * two surfaces never drift.
 */
export const PAYOUT_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Rejected",
}
