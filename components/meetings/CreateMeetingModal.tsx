"use client"

import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { z } from "zod"
import { CalendarPlus, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InviteePicker, type SelectedUser } from "@/components/meetings/InviteePicker"

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const

const CONTEXT_OPTIONS: { value: "general" | "tutoring" | "gig"; label: string }[] = [
  { value: "general", label: "General" },
  { value: "tutoring", label: "Tutoring" },
  { value: "gig", label: "Gig" },
]

const createMeetingSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Keep the title under 200 characters"),
  agenda: z.string().trim().max(2000, "Keep the agenda under 2000 characters").optional(),
  scheduled_at: z
    .string()
    .min(1, "Pick a start time")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), { message: "Pick a valid start time" })
    .refine((v) => new Date(v).getTime() > Date.now(), { message: "Start time must be in the future" }),
  duration_minutes: z.coerce.number().int().min(15).max(180),
  context: z.enum(["general", "tutoring", "gig"]),
  waiting_room: z.boolean(),
})

// z.coerce.number() makes the schema's INPUT type differ from its OUTPUT type
// (duration_minutes is `unknown` in, `number` out), so useForm needs the
// three-generic form <Input, Context, Output> — the same pattern used
// elsewhere in this repo — or zodResolver won't type-check.
type CreateMeetingInput = z.input<typeof createMeetingSchema>
type CreateMeetingValues = z.output<typeof createMeetingSchema>

export interface CreateMeetingModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

const emptyValues: CreateMeetingInput = {
  title: "",
  agenda: "",
  scheduled_at: "",
  duration_minutes: 30,
  context: "general",
  waiting_room: false,
}

/** Modal for POST /api/meetings — copies the shell/focus-trap/escape-close pattern from RequestFormModal. */
export function CreateMeetingModal({ open, onClose, onCreated }: CreateMeetingModalProps) {
  const prefersReducedMotion = useReducedMotion()
  const [invitees, setInvitees] = useState<SelectedUser[]>([])
  const [inviteesError, setInviteesError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const submittingRef = useRef(submitting)
  const dialogRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateMeetingInput, unknown, CreateMeetingValues>({
    resolver: zodResolver(createMeetingSchema),
    defaultValues: emptyValues,
    mode: "onBlur",
  })

  useEffect(() => {
    submittingRef.current = submitting
  }, [submitting])

  useEffect(() => {
    if (open) {
      reset(emptyValues)
      setInvitees([])
      setInviteesError(null)
      setSubmitError(null)
    }
    // Re-seed only when the modal opens, not on every keystroke inside it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("#meeting-title")?.focus()
    })
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submittingRef.current) {
        onCloseRef.current()
        return
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector))
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
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

  const submit = async (values: CreateMeetingValues) => {
    if (invitees.length === 0) {
      setInviteesError("Invite at least one person")
      return
    }
    setInviteesError(null)
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: values.title,
          agenda: values.agenda || undefined,
          scheduled_at: new Date(values.scheduled_at).toISOString(),
          duration_minutes: values.duration_minutes,
          context: values.context,
          invitee_ids: invitees.map((u) => u.id),
          waiting_room: values.waiting_room,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setSubmitError(json.error ?? "Could not create this meeting")
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

  const handleInviteesChange = (users: SelectedUser[]) => {
    setInvitees(users)
    if (users.length > 0) {
      setInviteesError(null)
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
            aria-labelledby="meeting-modal-title"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="glass relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarPlus className="h-5 w-5 text-accent-primary" />
                <h2 id="meeting-modal-title" className="font-display text-lg font-semibold text-text-primary">
                  Host a Meeting
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
                <Label htmlFor="meeting-title">Title</Label>
                <Input id="meeting-title" {...register("title")} placeholder="e.g. Weekly progress check-in" />
                {errors.title && <p className="text-xs text-accent-danger">{errors.title.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="meeting-agenda">Agenda (optional)</Label>
                <textarea
                  id="meeting-agenda"
                  {...register("agenda")}
                  rows={3}
                  placeholder="What will you cover?"
                  className="flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                />
                {errors.agenda && <p className="text-xs text-accent-danger">{errors.agenda.message}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="meeting-scheduled-at">Start time</Label>
                  <Input id="meeting-scheduled-at" type="datetime-local" {...register("scheduled_at")} />
                  {errors.scheduled_at && <p className="text-xs text-accent-danger">{errors.scheduled_at.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="meeting-duration">Duration</Label>
                  <select
                    id="meeting-duration"
                    {...register("duration_minutes")}
                    className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                  >
                    {DURATION_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d} min
                      </option>
                    ))}
                  </select>
                  {errors.duration_minutes && (
                    <p className="text-xs text-accent-danger">{errors.duration_minutes.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="meeting-context">Context</Label>
                <select
                  id="meeting-context"
                  {...register("context")}
                  className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                >
                  {CONTEXT_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {errors.context && <p className="text-xs text-accent-danger">{errors.context.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="meeting-invitees">Invite</Label>
                <InviteePicker id="meeting-invitees" value={invitees} onChange={handleInviteesChange} />
                {inviteesError && (
                  <p role="alert" className="text-xs text-accent-danger">
                    {inviteesError}
                  </p>
                )}
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-elevated px-3 py-2.5">
                <input
                  id="meeting-waiting-room"
                  type="checkbox"
                  {...register("waiting_room")}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-border bg-surface text-accent-primary focus:ring-2 focus:ring-accent-primary/50"
                />
                <div className="min-w-0">
                  <Label htmlFor="meeting-waiting-room" className="cursor-pointer">
                    Waiting room
                  </Label>
                  <p className="text-xs text-text-muted">Attendees wait until you admit them</p>
                </div>
              </div>

              {submitError && (
                <p role="alert" className="text-sm text-accent-danger">
                  {submitError}
                </p>
              )}

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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
