"use client"

import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { GraduationCap, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { studentSchema, type StudentValues } from "@/components/parent/student-schema"

export interface StudentFormModalProps {
  open: boolean
  onClose: () => void
  /** When set, the modal edits this child instead of creating a new one. */
  initialValues?: StudentValues
  onSubmit: (values: StudentValues) => Promise<{ error: string | null }>
}

const emptyValues: StudentValues = {
  full_name: "",
  date_of_birth: "",
  grade_level: "",
  notes: "",
}

export function StudentFormModal({ open, onClose, initialValues, onSubmit }: StudentFormModalProps) {
  const prefersReducedMotion = useReducedMotion()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const submittingRef = useRef(submitting)
  const dialogRef = useRef<HTMLDivElement>(null)
  const isEditing = Boolean(initialValues)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StudentValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: initialValues ?? emptyValues,
    mode: "onBlur",
  })

  useEffect(() => {
    submittingRef.current = submitting
  }, [submitting])

  // Re-seed the form whenever the modal opens (edit target may have changed
  // since last close) so stale values never leak between cards.
  useEffect(() => {
    if (open) {
      reset(initialValues ?? emptyValues)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValues])

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("#student-full-name")?.focus()
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

  const submit = async (values: StudentValues) => {
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
            aria-labelledby="student-modal-title"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="glass relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-accent-primary" />
                <h2 id="student-modal-title" className="font-display text-lg font-semibold text-text-primary">
                  {isEditing ? "Edit Child" : "Add a Child"}
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

            <form onSubmit={handleSubmit(submit)} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="student-full-name">Full Name</Label>
                <Input id="student-full-name" {...register("full_name")} placeholder="e.g. Ayesha Khan" />
                {errors.full_name && <p className="text-xs text-accent-danger">{errors.full_name.message}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="student-dob">Date of Birth (optional)</Label>
                  <Input id="student-dob" type="date" {...register("date_of_birth")} />
                  {errors.date_of_birth && <p className="text-xs text-accent-danger">{errors.date_of_birth.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="student-grade">Grade Level (optional)</Label>
                  <Input id="student-grade" {...register("grade_level")} placeholder="e.g. Grade 7" />
                  {errors.grade_level && <p className="text-xs text-accent-danger">{errors.grade_level.message}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="student-notes">Notes (optional)</Label>
                <textarea
                  id="student-notes"
                  {...register("notes")}
                  rows={3}
                  placeholder="Anything a teacher should know"
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
                  {isEditing ? "Save Changes" : "Add Child"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
