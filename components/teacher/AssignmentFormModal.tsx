"use client"

import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { BookOpen, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  createAssignmentSchema,
  type AssignedStudent,
  type CreateAssignmentValues,
} from "@/components/teacher/teaching-schema"

export interface AssignmentFormModalProps {
  open: boolean
  onClose: () => void
  students: AssignedStudent[]
  defaultStudentId?: string
  onCreated: () => void
}

const emptyValues: CreateAssignmentValues = {
  student_id: "",
  title: "",
  instructions: "",
  subject: "",
  due_date: "",
}

export function AssignmentFormModal({
  open,
  onClose,
  students,
  defaultStudentId,
  onCreated,
}: AssignmentFormModalProps) {
  const prefersReducedMotion = useReducedMotion()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const submittingRef = useRef(submitting)
  const dialogRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateAssignmentValues>({
    resolver: zodResolver(createAssignmentSchema),
    defaultValues: emptyValues,
    mode: "onBlur",
  })

  useEffect(() => {
    submittingRef.current = submitting
  }, [submitting])

  useEffect(() => {
    if (!open) return
    reset({ ...emptyValues, student_id: defaultStudentId ?? "" })
  }, [open, defaultStudentId, reset])

  // Matches the Escape-closes / focus-into-overlay / focus-restored-on-close
  // pattern established in components/teacher/WithdrawalRequestModal.tsx.
  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("#assign-title")?.focus()
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
  }, [open, onClose])

  const close = () => {
    if (submitting) return
    setSubmitError(null)
    onClose()
  }

  const submit = async (values: CreateAssignmentValues) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch("/api/teacher/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const payload = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setSubmitError(payload?.error ?? "Something went wrong. Please try again.")
        return
      }
      onCreated()
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
            aria-labelledby="assignment-modal-title"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="glass relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-accent-primary" />
                <h2 id="assignment-modal-title" className="font-display text-lg font-semibold text-text-primary">
                  New Assignment
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

            <p className="mt-2 text-sm text-text-muted">
              Only students currently assigned to you appear below.
            </p>

            <form onSubmit={handleSubmit(submit)} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="assign-student">Student</Label>
                <select
                  id="assign-student"
                  {...register("student_id")}
                  disabled={students.length === 0}
                  className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">
                    {students.length === 0 ? "No assigned students yet" : "Select a student"}
                  </option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                      {s.grade_level ? ` — ${s.grade_level}` : ""}
                    </option>
                  ))}
                </select>
                {errors.student_id && <p className="text-xs text-accent-danger">{errors.student_id.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assign-title">Title</Label>
                <Input id="assign-title" {...register("title")} placeholder="e.g. Chapter 4 worksheet" />
                {errors.title && <p className="text-xs text-accent-danger">{errors.title.message}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="assign-subject">Subject (optional)</Label>
                  <Input id="assign-subject" {...register("subject")} placeholder="e.g. Mathematics" />
                  {errors.subject && <p className="text-xs text-accent-danger">{errors.subject.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="assign-due">Due date (optional)</Label>
                  <Input id="assign-due" type="date" {...register("due_date")} />
                  {errors.due_date && <p className="text-xs text-accent-danger">{errors.due_date.message}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assign-instructions">Instructions (optional)</Label>
                <textarea
                  id="assign-instructions"
                  {...register("instructions")}
                  rows={4}
                  placeholder="What should the student do?"
                  className="flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                />
                {errors.instructions && <p className="text-xs text-accent-danger">{errors.instructions.message}</p>}
              </div>

              {submitError && <p className="text-sm text-accent-danger">{submitError}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={close} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="aurora" disabled={submitting || students.length === 0}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Assign Homework
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
