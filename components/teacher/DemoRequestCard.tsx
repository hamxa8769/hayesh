"use client"

import { Baby, Calendar, Check, Loader2, Video, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils/cn"
import { formatDateTime } from "@/lib/utils/format"
import type { DemoBooking, DemoBookingStatus } from "@/types/database"

/**
 * Semantic status pill shared by the demo-request list and the upcoming /
 * past agenda. Colors are the platform's semantic tokens ONLY (warning /
 * success / danger) — never the jade/gold aurora accent, which is reserved
 * for the one "moment that matters" per view.
 */
const STATUS_PILL: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "border-transparent bg-accent-warning/15 text-accent-warning" },
  confirmed: { label: "Confirmed", className: "border-transparent bg-accent-success/15 text-accent-success" },
  scheduled: { label: "Scheduled", className: "border-transparent bg-accent-success/15 text-accent-success" },
  completed: { label: "Completed", className: "border-transparent bg-surface-elevated text-text-muted" },
  cancelled: { label: "Declined", className: "border-transparent bg-accent-danger/15 text-accent-danger" },
  no_show: { label: "No Show", className: "border-transparent bg-accent-danger/15 text-accent-danger" },
}

export function StatusPill({ status }: { status: string | null | undefined }) {
  const style = STATUS_PILL[status ?? ""] ?? STATUS_PILL.pending
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide",
        style.className
      )}
    >
      {style.label}
    </span>
  )
}

export interface DemoRequestCardProps {
  booking: DemoBooking
  isConfirming: boolean
  isDeclining: boolean
  onConfirm: () => void
  onDecline: () => void
  onScheduleMeeting: () => void
}

export function DemoRequestCard({
  booking,
  isConfirming,
  isDeclining,
  onConfirm,
  onDecline,
  onScheduleMeeting,
}: DemoRequestCardProps) {
  const busy = isConfirming || isDeclining

  return (
    <div className="rounded-lg border border-accent-warning/25 bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-display text-base font-semibold text-text-primary">
              {booking.child_name}
              {typeof booking.child_age === "number" ? (
                <span className="ml-1.5 font-mono text-xs font-normal tabular-nums text-text-muted">
                  age {booking.child_age}
                </span>
              ) : null}
            </p>
            <StatusPill status={booking.status as DemoBookingStatus} />
          </div>
          <p className="mt-1 text-sm text-text-muted">{booking.subject}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1.5 font-mono tabular-nums">
          <Calendar className="h-3.5 w-3.5 text-accent-warning" />
          {formatDateTime(booking.scheduled_at)}
        </span>
        {booking.duration_mins ? (
          <span className="flex items-center gap-1.5 font-mono tabular-nums">
            <Baby className="h-3.5 w-3.5" />
            {booking.duration_mins} min
          </span>
        ) : null}
      </div>

      {booking.notes ? (
        <p className="mt-3 rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-text-muted">
          {booking.notes}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="default" onClick={onConfirm} disabled={busy}>
          {isConfirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Confirm
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDecline} disabled={busy}>
          {isDeclining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          Decline
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onScheduleMeeting} disabled={busy}>
          <Video className="h-3.5 w-3.5" />
          Schedule video meeting
        </Button>
      </div>
    </div>
  )
}
