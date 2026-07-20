"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { BookOpen, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { Assignment } from "@/components/parent/ProgressFeed"

export interface AssignmentSubmitModalProps {
  open: boolean
  assignment: Assignment | null
  onClose: () => void
  onSubmit: (note: string) => Promise<{ error: string | null }>
}

/**
 * Submit-homework modal for /parent/progress.
 *
 * TEXT-ONLY BY DESIGN: neither existing Supabase storage bucket fits this
 * flow. `teacher-photos` is public/profile-photo-only, and
 * `teacher-documents` (migration 009) grants read access only to the
 * uploading owner and admins — the assigning TEACHER could never read a
 * file the parent uploaded there, which is exactly who needs to see the
 * submission. Inventing a new bucket would require a migration, which is
 * out of scope here. So submission is a note only; the note is folded into
 * `assignments.submission_attachments` (jsonb) server-side by the caller —
 * this modal never touches any assignment column except through that one
 * `note` string.
 */
export function AssignmentSubmitModal({ open, assignment, onClose, onSubmit }: AssignmentSubmitModalProps) {
  const prefersReducedMotion = useReducedMotion()
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const submittingRef = useRef(submitting)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    submittingRef.current = submitting
  }, [submitting])

  useEffect(() => {
    if (open) {
      setNote("")
      setSubmitError(null)
    }
  }, [open, assignment])

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("#assignment-submit-note")?.focus()
    })
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submittingRef.current) {
        onClose()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("keydown", onKeyDown)
      previouslyFocused?.focus()
    }
  }, [open, onClose])

  const close = () => {
    if (submitting) return
    setSubmitError(null)
    onClose()
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const { error } = await onSubmit(note.trim())
      if (error) {
        setSubmitError(error)
        return
      }
      onClose()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && assignment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.button
            aria-hidden="true"
            tabIndex={-1}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="assignment-submit-title"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="glass relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-accent-primary" />
                <h2 id="assignment-submit-title" className="font-display text-lg font-semibold text-text-primary">
                  Submit Homework
                </h2>
              </div>
              <button
                onClick={close}
                aria-label="Close"
                className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-sm text-text-muted">
              Submitting <span className="text-text-primary">{assignment.title}</span>
              {assignment.subject ? ` for ${assignment.subject}` : ""}.
            </p>

            <div className="mt-5 space-y-1.5">
              <Label htmlFor="assignment-submit-note">Note (optional)</Label>
              <textarea
                id="assignment-submit-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Anything the teacher should know about this submission"
                className="flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
              />
              <p className="text-xs text-text-muted">
                File uploads aren&apos;t available yet for homework submissions — a note is all that&apos;s needed to
                mark this as submitted.
              </p>
            </div>

            {submitError && <p className="mt-3 text-sm text-accent-danger">{submitError}</p>}

            <div className="mt-5 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={close} disabled={submitting}>
                Cancel
              </Button>
              <Button type="button" variant="aurora" onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Mark as Submitted
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
