"use client"

import { useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { BookOpen, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { StatusPill, type PillTone } from "@/components/teacher/StatusPill"
import { formatDate } from "@/lib/utils/format"
import { PREFERRED_TIER_LABELS } from "@/components/parent/student-schema"
import type { StudentRequestWithRelations } from "@/components/parent/student-schema"

export interface RequestCardProps {
  request: StudentRequestWithRelations
  index?: number
  onCancel: () => Promise<void>
}

const STATUS_TONE: Record<string, PillTone> = {
  open: "info",
  assigned: "success",
  declined: "danger",
  cancelled: "neutral",
}

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  assigned: "Assigned",
  declined: "Declined",
  cancelled: "Cancelled",
}

/** One tutoring request's card on /parent/requests — status pill + cancel (delete) with confirm. */
export function RequestCard({ request, index = 0, onCancel }: RequestCardProps) {
  const prefersReducedMotion = useReducedMotion()
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const tone = STATUS_TONE[request.status] ?? "neutral"
  const label = STATUS_LABEL[request.status] ?? request.status
  const canCancel = request.status === "open"
  const tierLabel = request.preferred_tier
    ? PREFERRED_TIER_LABELS[request.preferred_tier as keyof typeof PREFERRED_TIER_LABELS] ?? request.preferred_tier
    : null

  const handleCancel = async () => {
    setCancelling(true)
    try {
      await onCancel()
    } finally {
      setCancelling(false)
      setConfirmingCancel(false)
    }
  }

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: index * 0.05 }}
    >
      <JarvisCard glow="none" className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-elevated text-accent-secondary">
              <BookOpen className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-bold text-text-primary">{request.subject}</p>
              <p className="mt-0.5 truncate text-xs text-text-muted">
                For {request.students?.full_name ?? "Unknown child"}
                {tierLabel ? ` · ${tierLabel}` : ""}
              </p>
            </div>
          </div>
          <StatusPill label={label} tone={tone} />
        </div>

        {request.notes && <p className="mt-3 line-clamp-3 text-sm text-text-muted">{request.notes}</p>}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
          <span>{request.created_at ? `Requested ${formatDate(request.created_at)}` : ""}</span>
          {request.assigned_teacher_id && (
            <span className="text-text-primary">
              Assigned to <span className="font-medium">{request.teachers?.display_name ?? request.assigned_teacher_id}</span>
            </span>
          )}
        </div>

        {canCancel && (
          confirmingCancel ? (
            <div className="mt-4 space-y-2 rounded-lg border border-accent-danger/30 bg-accent-danger/5 p-3">
              <p className="text-sm text-text-primary">Cancel this request? This cannot be undone.</p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmingCancel(false)} disabled={cancelling}>
                  Keep Request
                </Button>
                <Button type="button" variant="destructive" size="sm" onClick={handleCancel} disabled={cancelling}>
                  {cancelling ? "Cancelling..." : "Yes, cancel"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingCancel(true)}>
                <X className="h-3.5 w-3.5" />
                Cancel Request
              </Button>
            </div>
          )
        )}
      </JarvisCard>
    </motion.div>
  )
}
