"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { format } from "date-fns"
import { CalendarClock, CheckCircle2, Loader2, LogIn, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { demoBookingFormSchema, type DemoBookingFormValues } from "@/components/teacher-public/demo-booking-schema"

export interface DemoBookingModalProps {
  open: boolean
  onClose: () => void
  teacherId: string
  teacherName: string
  /** Only `subject` is used (a free-text fallback is offered regardless). */
  subjects: Array<{ subject: string }>
}

type ViewerState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "not-parent" }
  | { status: "parent" }

const defaultValues: Partial<DemoBookingFormValues> = {
  child_name: "",
  child_age: "",
  subject: "",
  scheduled_at: "",
  notes: "",
}

const CUSTOM_SUBJECT_VALUE = "__custom__"

export function DemoBookingModal({ open, onClose, teacherId, teacherName, subjects }: DemoBookingModalProps) {
  const prefersReducedMotion = useReducedMotion()
  const dialogRef = useRef<HTMLDivElement>(null)

  const [viewer, setViewer] = useState<ViewerState>({ status: "loading" })
  const [subjectMode, setSubjectMode] = useState<"select" | "custom">(subjects.length > 0 ? "select" : "custom")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const submittingRef = useRef(submitting)

  const minDateTime = useMemo(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"), [])

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<DemoBookingFormValues>({
    resolver: zodResolver(demoBookingFormSchema),
    defaultValues,
    mode: "onBlur",
  })

  useEffect(() => {
    submittingRef.current = submitting
  }, [submitting])

  // Determine whether the viewer can book a demo (signed-in parent) each
  // time the modal opens, since the session can change between opens.
  useEffect(() => {
    if (!open) return
    let cancelled = false

    const check = async () => {
      setViewer({ status: "loading" })
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (!cancelled) setViewer({ status: "signed-out" })
        return
      }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      if (cancelled) return
      setViewer(profile?.role === "parent" ? { status: "parent" } : { status: "not-parent" })
    }

    check()
    return () => {
      cancelled = true
    }
  }, [open])

  // Matches the Escape-closes / focus-into-overlay / focus-restored-on-close
  // pattern established in components/teacher/WithdrawalRequestModal.tsx.
  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("#demo-child-name")?.focus()
    })
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submittingRef.current) {
        closeAndReset()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("keydown", onKeyDown)
      previouslyFocused?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const closeAndReset = () => {
    if (submitting) return
    setSubmitError(null)
    setSuccess(false)
    reset(defaultValues)
    setSubjectMode(subjects.length > 0 ? "select" : "custom")
    onClose()
  }

  const submit = async (values: DemoBookingFormValues) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const isoScheduledAt = new Date(values.scheduled_at).toISOString()
      const res = await fetch("/api/demo-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacher_id: teacherId,
          child_name: values.child_name,
          child_age: values.child_age === "" || values.child_age === undefined ? undefined : Number(values.child_age),
          subject: values.subject,
          scheduled_at: isoScheduledAt,
          notes: values.notes || undefined,
        }),
      })

      const body: unknown = await res.json().catch(() => null)

      if (!res.ok) {
        const message =
          body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
            ? (body as { error: string }).error
            : "Could not request the demo. Please try again."
        setSubmitError(message)
        return
      }

      setSuccess(true)
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
            onClick={closeAndReset}
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-modal-title"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="glass relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-accent-primary" />
                <h2 id="demo-modal-title" className="font-display text-lg font-semibold text-text-primary">
                  Book a Free Demo
                </h2>
              </div>
              <button
                onClick={closeAndReset}
                aria-label="Close"
                className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {viewer.status === "loading" && (
              <div className="flex items-center gap-2 py-10 text-sm text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking your account...
              </div>
            )}

            {viewer.status === "signed-out" && (
              <div className="py-6 text-center">
                <p className="text-sm text-text-muted">Sign in to book a free demo with {teacherName}.</p>
                <Button asChild variant="aurora" className="mt-4">
                  <Link href="/auth/login">
                    <LogIn className="h-4 w-4" /> Sign in to book
                  </Link>
                </Button>
              </div>
            )}

            {viewer.status === "not-parent" && (
              <div className="py-6 text-center">
                <p className="text-sm text-text-muted">
                  Demo bookings are for parent accounts. Sign in with a parent account to book a free demo with {teacherName}.
                </p>
              </div>
            )}

            {viewer.status === "parent" && success && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-accent-success" />
                <p className="text-text-primary">Demo requested — {teacherName} will confirm shortly.</p>
                <Button variant="secondary" onClick={closeAndReset}>
                  Done
                </Button>
              </div>
            )}

            {viewer.status === "parent" && !success && (
              <form onSubmit={handleSubmit(submit)} className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="demo-child-name">Child&apos;s name</Label>
                    <Input id="demo-child-name" {...register("child_name")} placeholder="e.g. Ayesha" />
                    {errors.child_name && <p className="text-xs text-accent-danger">{errors.child_name.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="demo-child-age">Child&apos;s age (optional)</Label>
                    <Input id="demo-child-age" type="number" min={3} max={25} {...register("child_age")} placeholder="e.g. 10" />
                    {errors.child_age && <p className="text-xs text-accent-danger">{errors.child_age.message}</p>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="demo-subject">Subject</Label>
                  {subjectMode === "select" ? (
                    <select
                      id="demo-subject"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value === CUSTOM_SUBJECT_VALUE) {
                          setSubjectMode("custom")
                          setValue("subject", "", { shouldValidate: false })
                          return
                        }
                        setValue("subject", e.target.value, { shouldValidate: true })
                      }}
                      className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                    >
                      <option value="" disabled>
                        Select a subject
                      </option>
                      {subjects.map((s) => (
                        <option key={s.subject} value={s.subject}>
                          {s.subject}
                        </option>
                      ))}
                      <option value={CUSTOM_SUBJECT_VALUE}>Other...</option>
                    </select>
                  ) : (
                    <div className="space-y-1.5">
                      <Input id="demo-subject" {...register("subject")} placeholder="What subject is this for?" />
                      {subjects.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSubjectMode("select")
                            setValue("subject", "", { shouldValidate: false })
                          }}
                          className="text-xs text-accent-primary underline-offset-2 hover:underline"
                        >
                          Choose from {teacherName}&apos;s subjects instead
                        </button>
                      )}
                    </div>
                  )}
                  {errors.subject && <p className="text-xs text-accent-danger">{errors.subject.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="demo-scheduled-at">Preferred date &amp; time</Label>
                  <Input
                    id="demo-scheduled-at"
                    type="datetime-local"
                    min={minDateTime}
                    {...register("scheduled_at")}
                  />
                  {errors.scheduled_at && <p className="text-xs text-accent-danger">{errors.scheduled_at.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="demo-notes">Notes (optional)</Label>
                  <textarea
                    id="demo-notes"
                    {...register("notes")}
                    rows={3}
                    placeholder="Anything the teacher should know before the demo"
                    className="flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                  />
                  {errors.notes && <p className="text-xs text-accent-danger">{errors.notes.message}</p>}
                </div>

                {submitError && <p className="text-sm text-accent-danger">{submitError}</p>}

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="secondary" onClick={closeAndReset} disabled={submitting} className="w-full sm:w-auto">
                    Cancel
                  </Button>
                  <Button type="submit" variant="aurora" disabled={submitting} className="w-full sm:w-auto">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Request Demo
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
