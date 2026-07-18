"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { BookOpen, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PREFERRED_TIERS, PREFERRED_TIER_LABELS, requestSchema, type RequestValues } from "@/components/parent/student-schema"
import type { Student } from "@/components/parent/student-schema"

export interface RequestFormModalProps {
  open: boolean
  onClose: () => void
  students: Student[]
  onSubmit: (values: RequestValues) => Promise<{ error: string | null }>
}

const emptyValues: RequestValues = {
  student_id: "",
  subject: "",
  preferred_tier: "standard",
  notes: "",
}

export function RequestFormModal({ open, onClose, students, onSubmit }: RequestFormModalProps) {
  const prefersReducedMotion = useReducedMotion()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const submittingRef = useRef(submitting)
  const dialogRef = useRef<HTMLDivElement>(null)
  const hasChildren = students.length > 0

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { ...emptyValues, student_id: students[0]?.id ?? "" },
    mode: "onBlur",
  })

  useEffect(() => {
    submittingRef.current = submitting
  }, [submitting])

  useEffect(() => {
    if (open) {
      reset({ ...emptyValues, student_id: students[0]?.id ?? "" })
    }
    // Re-seed only when the modal opens or the eligible child list changes —
    // not on every keystroke inside the form itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, students])

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("#request-subject, #request-no-children-link")?.focus()
    })
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submittingRef.current) {
        setSubmitError(null)
        onClose()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("keydown", onKeyDown)
      previouslyFocused?.focus()
    }
  }, [open])

  const close = () => {
    if (submitting) return
    setSubmitError(null)
    onClose()
  }

  const submit = async (values: RequestValues) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const { error } = await onSubmit(values)
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
      {open && (
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
            aria-labelledby="request-modal-title"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="glass relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-accent-primary" />
                <h2 id="request-modal-title" className="font-display text-lg font-semibold text-text-primary">
                  Request a Teacher
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

            {!hasChildren ? (
              <div className="mt-5 space-y-4">
                <p className="text-sm text-text-muted">
                  You need to add a child before requesting a teacher. Add your child&apos;s profile first, then come back
                  to request tutoring for them.
                </p>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="secondary" onClick={close}>
                    Close
                  </Button>
                  <Button asChild variant="aurora">
                    <Link id="request-no-children-link" href="/parent/students">
                      Add a Child
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit(submit)} className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="request-student">Child</Label>
                  <select
                    id="request-student"
                    {...register("student_id")}
                    className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                  >
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                      </option>
                    ))}
                  </select>
                  {errors.student_id && <p className="text-xs text-accent-danger">{errors.student_id.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="request-subject">Subject</Label>
                  <Input id="request-subject" {...register("subject")} placeholder="e.g. Algebra, English Literature" />
                  {errors.subject && <p className="text-xs text-accent-danger">{errors.subject.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="request-tier">Preferred Tier</Label>
                  <select
                    id="request-tier"
                    {...register("preferred_tier")}
                    className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                  >
                    {PREFERRED_TIERS.map((tier) => (
                      <option key={tier} value={tier}>
                        {PREFERRED_TIER_LABELS[tier]}
                      </option>
                    ))}
                  </select>
                  {errors.preferred_tier && <p className="text-xs text-accent-danger">{errors.preferred_tier.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="request-notes">Notes (optional)</Label>
                  <textarea
                    id="request-notes"
                    {...register("notes")}
                    rows={3}
                    placeholder="Goals, schedule preferences, anything the admin should know"
                    className="flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                  />
                  {errors.notes && <p className="text-xs text-accent-danger">{errors.notes.message}</p>}
                </div>

                {submitError && <p className="text-sm text-accent-danger">{submitError}</p>}

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={close} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="aurora" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Submit Request
                  </Button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
