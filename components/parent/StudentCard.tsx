"use client"

import { useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { GraduationCap, Pencil, Trash2, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { formatDate } from "@/lib/utils/format"
import type { Student } from "@/components/parent/student-schema"

export interface StudentCardProps {
  student: Student
  index?: number
  onEdit: () => void
  onToggleActive: () => Promise<void>
  onDelete: () => Promise<void>
}

/** One child's card on /parent/students — edit, deactivate/reactivate, delete (with confirm). */
export function StudentCard({ student, index = 0, onEdit, onToggleActive, onDelete }: StudentCardProps) {
  const prefersReducedMotion = useReducedMotion()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [togglingActive, setTogglingActive] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isActive = student.is_active ?? true

  const handleToggleActive = async () => {
    setTogglingActive(true)
    try {
      await onToggleActive()
    } finally {
      setTogglingActive(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await onDelete()
    } finally {
      setDeleting(false)
      setConfirmingDelete(false)
    }
  }

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: index * 0.05 }}
    >
      <JarvisCard glow="none" className={`p-5 ${isActive ? "" : "opacity-60"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-elevated text-accent-primary">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-bold text-text-primary">{student.full_name}</p>
              <p className="mt-0.5 truncate text-xs text-text-muted">
                {student.grade_level || "No grade set"}
                {student.date_of_birth ? ` · Born ${formatDate(student.date_of_birth)}` : ""}
              </p>
            </div>
          </div>
          {!isActive && (
            <span className="shrink-0 rounded-full border border-line-strong bg-surface-elevated px-2.5 py-0.5 font-mono text-xs uppercase tracking-wide text-text-muted">
              Inactive
            </span>
          )}
        </div>

        {student.notes && <p className="mt-3 line-clamp-3 text-sm text-text-muted">{student.notes}</p>}

        {confirmingDelete ? (
          <div className="mt-4 space-y-2 rounded-lg border border-accent-danger/30 bg-accent-danger/5 p-3">
            <p className="text-sm text-text-primary">Remove {student.full_name}? This cannot be undone.</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Removing..." : "Yes, remove"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleToggleActive} disabled={togglingActive}>
              <Undo2 className="h-3.5 w-3.5" />
              {togglingActive ? "Saving..." : isActive ? "Deactivate" : "Reactivate"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
          </div>
        )}
      </JarvisCard>
    </motion.div>
  )
}
