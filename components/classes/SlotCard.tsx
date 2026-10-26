"use client"

import { useState } from "react"
import { Loader2, Pause, Pencil, Play, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils/cn"
import { addMinutesToHhmm, hhmm, type TimetableSlot } from "@/components/classes/class-types"

interface SlotCardProps {
  slot: TimetableSlot
  onEdit: (slot: TimetableSlot) => void
  onSetActive: (slot: TimetableSlot, active: boolean) => Promise<string | null>
  onRemove: (slot: TimetableSlot) => Promise<string | null>
}

export function SlotCard({ slot, onEdit, onSetActive, onRemove }: SlotCardProps) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true)
    setError(null)
    const message = await fn()
    if (message) setError(message)
    setBusy(false)
    setConfirmRemove(false)
  }

  const names = slot.members.map((m) => m.child_name).filter((n): n is string => Boolean(n))

  return (
    <div data-testid="slot-card" className={cn("rounded-lg border bg-surface-elevated p-3", slot.active ? "border-border" : "border-accent-warning/30")}>
      <p className="font-mono text-xs tabular-nums text-text-primary">
        {hhmm(slot.start_time)}–{addMinutesToHhmm(slot.start_time, slot.duration_minutes)}
        <span className="ml-1.5 text-text-muted">{slot.timezone}</span>
      </p>
      <p className="mt-1 text-sm font-semibold text-text-primary">{slot.title}</p>
      {slot.subject && <p className="text-xs text-text-muted">{slot.subject}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full border border-line-strong px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-text-muted">
          {slot.is_group ? "Group" : "Private"}
        </span>
        {!slot.active && (
          <span className="rounded-full bg-accent-warning/20 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-accent-warning">Paused</span>
        )}
      </div>
      {names.length > 0 && <p className="mt-2 text-xs text-text-muted">{names.join(", ")}</p>}

      {error && <p role="alert" className="mt-2 text-xs text-accent-danger">{error}</p>}

      {confirmRemove ? (
        <div className="mt-3 space-y-2 rounded-lg border border-accent-danger/40 bg-accent-danger/10 p-2">
          <p className="text-xs text-text-primary">Remove this class? Future classes from it will be cancelled.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={busy} onClick={() => void run(() => onRemove(slot))}>
              {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />} Yes, remove
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmRemove(false)}>Keep</Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onEdit(slot)}>
            <Pencil className="h-3 w-3" aria-hidden="true" /> Edit
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => onSetActive(slot, !slot.active))}>
            {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : slot.active ? <Pause className="h-3 w-3" aria-hidden="true" /> : <Play className="h-3 w-3" aria-hidden="true" />}
            {slot.active ? "Pause" : "Resume"}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmRemove(true)} className="text-accent-danger hover:text-accent-danger">
            <Trash2 className="h-3 w-3" aria-hidden="true" /> Remove
          </Button>
        </div>
      )}
    </div>
  )
}
