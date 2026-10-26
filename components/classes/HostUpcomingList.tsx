"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  formatLocalDateTime,
  readError,
  type UpcomingClass,
  type UpcomingResponse,
} from "@/components/classes/class-types"

interface HostUpcomingListProps {
  /** Bump to force a refetch (e.g. after the timetable changed). */
  refreshKey: number
}

export function HostUpcomingList({ refreshKey }: HostUpcomingListProps) {
  const [items, setItems] = useState<UpcomingClass[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch("/api/classes/upcoming", { cache: "no-store" })
      if (!res.ok) throw new Error(await readError(res, "Could not load upcoming classes"))
      const json = (await res.json()) as UpcomingResponse
      setItems(json.items.filter((i) => i.isHost))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load upcoming classes")
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const cancel = async (id: string) => {
    setBusy(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/classes/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reason.trim() ? { reason: reason.trim() } : {}),
      })
      if (!res.ok) {
        setActionError(await readError(res, "Could not cancel the class"))
        return
      }
      setCancelling(null)
      setReason("")
      await load()
    } catch {
      setActionError("Network error — please try again")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-5" aria-label="Next 14 days">
      <h3 className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Next 14 days</h3>
      <div className="mt-4">
        {error ? (
          <p className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-sm text-accent-danger">
            {error}{" "}
            <button type="button" className="underline" onClick={() => void load()}>Retry</button>
          </p>
        ) : items === null ? (
          <div className="h-16 animate-pulse rounded-lg border border-border bg-surface-elevated" aria-busy="true" />
        ) : items.length === 0 ? (
          <p className="text-sm text-text-muted">No upcoming classes yet. They appear here once your timetable has students with active tuition.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((c) => (
              <li key={c.id} data-testid="host-upcoming" className="rounded-lg border border-border bg-surface-elevated p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">{c.title}</p>
                    <p className="font-mono text-xs tabular-nums text-text-muted">
                      {formatLocalDateTime(c.scheduled_at)} · {c.studentCount} {c.studentCount === 1 ? "student" : "students"}
                    </p>
                  </div>
                  {cancelling !== c.id && (
                    <Button size="sm" variant="outline" onClick={() => { setCancelling(c.id); setReason(""); setActionError(null) }}>
                      Cancel this class
                    </Button>
                  )}
                </div>
                {cancelling === c.id && (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    <Input
                      aria-label="Reason (optional)"
                      placeholder="Reason (optional) — students are notified"
                      value={reason}
                      maxLength={300}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    {actionError && <p role="alert" className="text-xs text-accent-danger">{actionError}</p>}
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" disabled={busy} onClick={() => void cancel(c.id)}>
                        {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />} Confirm cancel
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setCancelling(null)}>Keep class</Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
