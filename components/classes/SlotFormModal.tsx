"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, X } from "lucide-react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils/cn"
import {
  DURATION_OPTIONS,
  WEEKDAY_NAMES,
  WEEK_ORDER,
  hhmm,
  readError,
  type Enrolment,
  type TimetableSlot,
} from "@/components/classes/class-types"

const DEFAULT_ZONE = "Asia/Karachi"

const formSchema = z.object({
  title: z.string().trim().min(1, "Give the class a title").max(120, "Keep the title under 120 characters"),
  subject: z.string().trim().max(80, "Keep the subject under 80 characters"),
  weekday: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a start time"),
  duration_minutes: z.number().int().min(15).max(240),
  is_group: z.boolean(),
  timezone: z.string().min(1),
  subscription_ids: z.array(z.string().uuid()).min(1, "Choose at least one student"),
})

interface SlotFormModalProps {
  editing: TimetableSlot | null
  enrolments: Enrolment[]
  onClose: () => void
  onSaved: () => void
}

function browserZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}

export function SlotFormModal({ editing, enrolments, onClose, onSaved }: SlotFormModalProps) {
  const [title, setTitle] = useState(editing?.title ?? "")
  const [subject, setSubject] = useState(editing?.subject ?? "")
  const [weekday, setWeekday] = useState<number>(editing?.weekday ?? 1)
  const [startTime, setStartTime] = useState(editing ? hhmm(editing.start_time) : "16:00")
  const [duration, setDuration] = useState<number>(editing?.duration_minutes ?? 60)
  const [isGroup, setIsGroup] = useState(editing?.is_group ?? false)
  const [timezone, setTimezone] = useState(editing?.timezone ?? DEFAULT_ZONE)
  const [selected, setSelected] = useState<string[]>(editing?.members.map((m) => m.subscription_id) ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const zones = useMemo(() => {
    const set = new Set<string>([DEFAULT_ZONE])
    const local = browserZone()
    if (local) set.add(local)
    if (editing) set.add(editing.timezone)
    return [...set]
  }, [editing])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [busy, onClose])

  // Members of an edited slot that are no longer in the enrolment list still need showing.
  const options: Enrolment[] = useMemo(() => {
    const known = new Set(enrolments.map((e) => e.id))
    const extra: Enrolment[] = (editing?.members ?? [])
      .filter((m) => !known.has(m.subscription_id))
      .map((m) => ({
        id: m.subscription_id,
        child_name: m.child_name ?? "Student",
        subject: m.subject ?? "",
        tier: null,
        status: m.subscription_status ?? "active",
        parent_name: m.parent_name,
      }))
    return [...extra, ...enrolments]
  }, [enrolments, editing])

  const toggle = (id: string) => {
    setError(null)
    if (!isGroup) {
      setSelected([id])
      return
    }
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const setMode = (group: boolean) => {
    setIsGroup(group)
    if (!group) setSelected((prev) => prev.slice(0, 1))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const parsed = formSchema.safeParse({
      title,
      subject,
      weekday,
      start_time: startTime,
      duration_minutes: duration,
      is_group: isGroup,
      timezone,
      subscription_ids: selected,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form and try again")
      return
    }
    if (!parsed.data.is_group && parsed.data.subscription_ids.length !== 1) {
      setError("A private class has exactly one student")
      return
    }
    const v = parsed.data
    const payload = {
      title: v.title,
      subject: v.subject === "" ? (editing ? null : undefined) : v.subject,
      weekday: v.weekday,
      start_time: v.start_time,
      duration_minutes: v.duration_minutes,
      is_group: v.is_group,
      timezone: v.timezone,
      subscription_ids: v.subscription_ids,
    }
    setBusy(true)
    try {
      const res = await fetch(editing ? `/api/timetable/${editing.id}` : "/api/timetable", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        setError(await readError(res, "Could not save the class"))
        return
      }
      onSaved()
    } catch {
      setError("Network error — please try again")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={() => !busy && onClose()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit class" : "Add class"}
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-lg border border-line-strong bg-surface p-4 sm:max-w-lg sm:rounded-lg sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-text-primary">
            {editing ? "Edit class" : "Add class"}
          </h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="text-text-muted hover:text-text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="slot-title">Title</Label>
            <Input id="slot-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Algebra with Ayesha" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slot-subject">Subject</Label>
            <Input id="slot-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={80} placeholder="Mathematics" />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="slot-day">Day</Label>
              <select id="slot-day" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text-primary">
                {WEEK_ORDER.map((d) => (
                  <option key={d} value={d}>{WEEKDAY_NAMES[d]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slot-start">Start time</Label>
              <Input id="slot-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slot-duration">Duration</Label>
              <select id="slot-duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text-primary">
                {DURATION_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d} min</option>
                ))}
                {!(DURATION_OPTIONS as readonly number[]).includes(duration) && <option value={duration}>{duration} min</option>}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slot-tz">Times are in</Label>
            <select id="slot-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text-primary">
              {zones.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-text-primary">Class type</legend>
            <div className="inline-flex rounded-lg border border-border p-0.5" role="group">
              {([false, true] as const).map((g) => (
                <button
                  key={String(g)}
                  type="button"
                  aria-pressed={isGroup === g}
                  onClick={() => setMode(g)}
                  className={cn("rounded-md px-4 py-1.5 text-sm transition-colors", isGroup === g ? "bg-surface-elevated text-text-primary" : "text-text-muted hover:text-text-primary")}
                >
                  {g ? "Group" : "Private"}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-text-primary">
              {isGroup ? "Students (choose one or more)" : "Student (choose one)"}
            </legend>
            {options.length === 0 ? (
              <p className="rounded-lg border border-border bg-surface-elevated p-3 text-sm text-text-muted">
                You have no enrolled students yet. Students appear here once a parent subscribes to your tuition.
              </p>
            ) : (
              <ul className="max-h-56 space-y-1.5 overflow-y-auto">
                {options.map((o) => {
                  const checked = selected.includes(o.id)
                  return (
                    <li key={o.id}>
                      <label className={cn("flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5", checked ? "border-line-strong bg-surface-elevated" : "border-border")}>
                        <input
                          type={isGroup ? "checkbox" : "radio"}
                          name="slot-students"
                          checked={checked}
                          onChange={() => toggle(o.id)}
                          className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--color-accent-primary)]"
                        />
                        <span className="min-w-0 text-sm">
                          <span className="block text-text-primary">{o.child_name}</span>
                          <span className="block text-xs text-text-muted">
                            {o.subject}
                            {o.parent_name ? ` · ${o.parent_name}` : ""} ·{" "}
                            <span className={o.status === "active" ? "text-accent-success" : "text-accent-warning"}>{o.status.replace("_", " ")}</span>
                          </span>
                          {o.status === "pending_payment" && (
                            <span className="mt-0.5 block text-xs text-accent-warning">joins classes once tuition is paid</span>
                          )}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </fieldset>

          {error && (
            <p role="alert" className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-sm text-accent-danger">
              {error}
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="aurora" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {editing ? "Save changes" : "Add class"}
          </Button>
        </div>
      </form>
    </div>
  )
}
