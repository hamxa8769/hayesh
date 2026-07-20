"use client"

import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Loader2, Lock, StickyNote, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils/cn"
import { noteSchema, type NoteValues, type AssignedStudent } from "@/components/teacher/teaching-schema"

export interface NoteFormModalProps {
  open: boolean
  onClose: () => void
  teacherId: string
  student: AssignedStudent | null
  onCreated: () => void
}

const emptyValues: NoteValues = { body: "", is_private: false }

export function NoteFormModal({ open, onClose, teacherId, student, onCreated }: NoteFormModalProps) {
  const prefersReducedMotion = useReducedMotion()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const submittingRef = useRef(submitting)
  const dialogRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<NoteValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: emptyValues,
    mode: "onBlur",
  })

  const isPrivate = watch("is_private")

  useEffect(() => {
    submittingRef.current = submitting
  }, [submitting])

  useEffect(() => {
    if (!open) return
    reset(emptyValues)
    setSubmitError(null)
  }, [open, reset])

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("#note-body")?.focus()
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
    onClose()
  }

  const submit = async (values: NoteValues) => {
    if (!student) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const supabase = createClient()
      // Direct client insert: the teacher owns these rows outright under
      // migration 011's "Teacher manages own notes" policy.
      const { error } = await supabase.from("teacher_notes").insert({
        teacher_id: teacherId,
        student_id: student.id,
        parent_id: student.parent_id,
        body: values.body,
        is_private: values.is_private,
      })

      if (error) {
        setSubmitError(error.message)
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
      {open && student && (
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
            aria-labelledby="note-modal-title"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="glass relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <StickyNote className="h-5 w-5 text-accent-primary" />
                <h2 id="note-modal-title" className="font-display text-lg font-semibold text-text-primary">
                  Note about {student.full_name}
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
                <Label htmlFor="note-body">Note</Label>
                <textarea
                  id="note-body"
                  {...register("body")}
                  rows={5}
                  placeholder="Progress, behaviour, or anything worth recording about this student"
                  className="flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                />
                {errors.body && <p className="text-xs text-accent-danger">{errors.body.message}</p>}
              </div>

              {/* This toggle has real privacy consequences: a private note is
                  never visible to the parent (enforced by migration 011's
                  "Parent sees own non-private notes" SELECT policy, which
                  filters on is_private = false), so make the choice explicit
                  rather than a bare checkbox. */}
              <div className="space-y-2">
                <Label>Visibility</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setValue("is_private", true)}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border p-3 text-left transition-colors",
                      isPrivate
                        ? "border-accent-primary/50 bg-accent-primary/10"
                        : "border-border bg-surface-elevated hover:border-line-strong"
                    )}
                  >
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
                    <span>
                      <span className="block text-sm font-medium text-text-primary">Private</span>
                      <span className="block text-xs text-text-muted">Only visible to you</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue("is_private", false)}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border p-3 text-left transition-colors",
                      !isPrivate
                        ? "border-accent-primary/50 bg-accent-primary/10"
                        : "border-border bg-surface-elevated hover:border-line-strong"
                    )}
                  >
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
                    <span>
                      <span className="block text-sm font-medium text-text-primary">Shared</span>
                      <span className="block text-xs text-text-muted">Shared with the parent</span>
                    </span>
                  </button>
                </div>
              </div>

              {submitError && <p className="text-sm text-accent-danger">{submitError}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={close} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="aurora" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Note
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
