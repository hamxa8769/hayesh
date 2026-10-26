"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HostUpcomingList } from "@/components/classes/HostUpcomingList"
import { SlotCard } from "@/components/classes/SlotCard"
import { SlotFormModal } from "@/components/classes/SlotFormModal"
import {
  WEEKDAY_NAMES,
  WEEK_ORDER,
  readError,
  type TimetableResponse,
  type TimetableSlot,
} from "@/components/classes/class-types"

export function TimetableEditor() {
  const [data, setData] = useState<TimetableResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<{ editing: TimetableSlot | null } | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch("/api/timetable", { cache: "no-store" })
      if (!res.ok) throw new Error(await readError(res, "Could not load your timetable"))
      setData((await res.json()) as TimetableResponse)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load your timetable")
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const changed = useCallback(async () => {
    await load()
    setRefreshKey((n) => n + 1)
  }, [load])

  const byDay = useMemo(() => {
    const map = new Map<number, TimetableSlot[]>()
    for (const d of WEEK_ORDER) map.set(d, [])
    for (const s of data?.slots ?? []) map.get(s.weekday)?.push(s)
    for (const list of map.values()) list.sort((a, b) => a.start_time.localeCompare(b.start_time))
    return map
  }, [data])

  const setActive = async (slot: TimetableSlot, active: boolean): Promise<string | null> => {
    try {
      const res = await fetch(`/api/timetable/${slot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      })
      if (!res.ok) return await readError(res, "Could not update the class")
      await changed()
      return null
    } catch {
      return "Network error — please try again"
    }
  }

  const remove = async (slot: TimetableSlot): Promise<string | null> => {
    try {
      const res = await fetch(`/api/timetable/${slot.id}`, { method: "DELETE" })
      if (!res.ok) return await readError(res, "Could not remove the class")
      await changed()
      return null
    } catch {
      return "Network error — please try again"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text-primary">Timetable</h2>
          <p className="mt-1 max-w-prose text-sm text-text-muted">
            Classes are created automatically from this timetable for students whose tuition is active. Students are reminded 1 hour before.
          </p>
        </div>
        <Button variant="aurora" onClick={() => setModal({ editing: null })} disabled={!data}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Add class
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-4 text-sm text-accent-danger">
          {error}{" "}
          <button type="button" className="underline" onClick={() => void load()}>Retry</button>
        </div>
      ) : data === null ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7" aria-busy="true">
          {WEEK_ORDER.map((d) => (
            <div key={d} className="h-28 animate-pulse rounded-lg border border-border bg-surface" />
          ))}
        </div>
      ) : (
        <>
          {data.slots.length === 0 && (
            <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
              Your timetable is empty. Add your first weekly class to get started.
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-7" data-testid="timetable-grid">
            {WEEK_ORDER.map((d) => {
              const slots = byDay.get(d) ?? []
              return (
                <section key={d} aria-label={WEEKDAY_NAMES[d]} className="min-w-0 space-y-2">
                  <h3 className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
                    <span className="md:hidden">{WEEKDAY_NAMES[d]}</span>
                    <span className="hidden md:inline">{WEEKDAY_NAMES[d].slice(0, 3)}</span>
                  </h3>
                  {slots.length === 0 ? (
                    <p className="text-xs text-text-disabled">No classes</p>
                  ) : (
                    slots.map((s) => (
                      <SlotCard key={s.id} slot={s} onEdit={(slot) => setModal({ editing: slot })} onSetActive={setActive} onRemove={remove} />
                    ))
                  )}
                </section>
              )
            })}
          </div>
        </>
      )}

      <HostUpcomingList refreshKey={refreshKey} />

      {modal && data && (
        <SlotFormModal
          editing={modal.editing}
          enrolments={data.enrolments}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            void changed()
          }}
        />
      )}
    </div>
  )
}
