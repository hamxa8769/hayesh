"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { CheckCircle2, ExternalLink, Loader2, Video, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * Schedules a video meeting for a demo booking by POSTing to
 * `/api/meetings` — owned by the concurrent LiveKit-core agent building
 * that route and the `/meet/[id]` room page. This modal never imports
 * lib/livekit/** or components/video/**; it only links to `/meet/{id}` by
 * URL once the meeting row comes back from that API.
 *
 * Contract (per orchestrator brief):
 *   POST /api/meetings
 *     body: { participant_id, title, agenda?, scheduled_at (ISO, future),
 *             duration_minutes, context: 'tutoring' | 'gig', related_id? }
 *     -> created meeting row, including `id` and `room_url`
 */

const DURATION_OPTIONS = [15, 30, 45, 60, 90] as const

const scheduleSchema = z.object({
  scheduled_at: z
    .string()
    .min(1, "Pick a date and time")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Enter a valid date and time")
    .refine((v) => new Date(v).getTime() > Date.now(), "Must be in the future"),
  duration_minutes: z
    .number({ error: "Select a duration" })
    .int("Enter a whole number")
    .min(15, "At least 15 minutes")
    .max(120, "At most 120 minutes"),
})

type ScheduleValues = z.infer<typeof scheduleSchema>

export interface ScheduleMeetingBookingInfo {
  id: string
  parent_id: string
  child_name: string
  subject: string
  notes?: string | null
}

export interface ScheduledMeetingResult {
  id: string
  room_url: string | null
}

export interface ScheduleMeetingModalProps {
  open: boolean
  onClose: () => void
  booking: ScheduleMeetingBookingInfo | null
  onScheduled: (meeting: ScheduledMeetingResult) => void | Promise<void>
}

const defaultValues: Partial<ScheduleValues> = {
  scheduled_at: "",
  duration_minutes: 30,
}

function isMeetingResponse(value: unknown): value is ScheduledMeetingResult {
  return typeof value === "object" && value !== null && typeof (value as { id?: unknown }).id === "string"
}

export function ScheduleMeetingModal({ open, onClose, booking, onScheduled }: ScheduleMeetingModalProps) {
  const prefersReducedMotion = useReducedMotion()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [scheduled, setScheduled] = useState<ScheduledMeetingResult | null>(null)
  const submittingRef = useRef(submitting)
  const dialogRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ScheduleValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues,
    mode: "onBlur",
  })

  const title = useMemo(
    () => (booking ? `Demo lesson — ${booking.child_name} (${booking.subject})` : ""),
    [booking]
  )

  useEffect(() => {
    submittingRef.current = submitting
  }, [submitting])

  const resetAndClose = () => {
    setSubmitError(null)
    setScheduled(null)
    reset(defaultValues)
    onClose()
  }

  // Matches the Escape-closes / focus-into-overlay / focus-restored-on-close
  // pattern established in components/teacher/WithdrawalRequestModal.tsx.
  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("#meeting-scheduled-at")?.focus()
    })
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submittingRef.current) {
        resetAndClose()
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

  const close = () => {
    if (submitting) return
    resetAndClose()
  }

  const submit = async (values: ScheduleValues) => {
    if (!booking) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participant_id: booking.parent_id,
          title,
          agenda: booking.notes || undefined,
          scheduled_at: new Date(values.scheduled_at).toISOString(),
          duration_minutes: values.duration_minutes,
          context: "tutoring",
          related_id: booking.id,
        }),
      })

      let payload: unknown = null
      try {
        payload = await res.json()
      } catch {
        payload = null
      }

      if (!res.ok) {
        const message =
          payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error: string }).error
            : "Could not schedule the meeting. Please try again."
        setSubmitError(message)
        return
      }

      if (!isMeetingResponse(payload)) {
        setSubmitError("The meeting was created but the response was unexpected. Refresh to check your sessions.")
        return
      }

      const meeting: ScheduledMeetingResult = { id: payload.id, room_url: payload.room_url ?? null }
      setScheduled(meeting)
      await onScheduled(meeting)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && booking && (
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
            aria-labelledby="schedule-meeting-title"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="glass relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-border p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Video className="h-5 w-5 text-accent-primary" />
                <h2 id="schedule-meeting-title" className="font-display text-lg font-semibold text-text-primary">
                  Schedule Video Meeting
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

            <p className="mt-2 truncate text-sm text-text-muted">{title}</p>

            {scheduled ? (
              <div className="mt-5 space-y-4">
                <div className="flex items-start gap-3 rounded-lg border border-accent-success/25 bg-accent-success/10 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent-success" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">Meeting scheduled</p>
                    <p className="mt-1 text-sm text-text-muted">
                      The demo request has been confirmed and the parent has been notified.
                    </p>
                  </div>
                </div>
                {scheduled.room_url ? (
                  <a
                    href={`/meet/${scheduled.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-lg border border-accent-primary/30 bg-accent-primary/10 px-4 py-2.5 text-sm font-medium text-accent-primary transition-colors hover:bg-accent-primary/20"
                  >
                    <ExternalLink className="h-4 w-4" /> Open meeting room
                  </a>
                ) : (
                  <a
                    href={`/meet/${scheduled.id}`}
                    className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:border-line-strong"
                  >
                    View meeting
                  </a>
                )}
                <div className="flex justify-end">
                  <Button type="button" variant="secondary" onClick={resetAndClose}>
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit(submit)} className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="meeting-scheduled-at">Date &amp; time</Label>
                  <Input
                    id="meeting-scheduled-at"
                    type="datetime-local"
                    {...register("scheduled_at")}
                  />
                  {errors.scheduled_at && <p className="text-xs text-accent-danger">{errors.scheduled_at.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="meeting-duration">Duration</Label>
                  <select
                    id="meeting-duration"
                    {...register("duration_minutes", { valueAsNumber: true })}
                    className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                  >
                    {DURATION_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} minutes
                      </option>
                    ))}
                  </select>
                  {errors.duration_minutes && (
                    <p className="text-xs text-accent-danger">{errors.duration_minutes.message}</p>
                  )}
                </div>

                {submitError && <p className="text-sm text-accent-danger">{submitError}</p>}

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={close} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="aurora" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Schedule Meeting
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
