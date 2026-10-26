"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Users, Video } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { isWithinJoinWindow, joinWindow } from "@/lib/classes/join-window"
import {
  formatLocalDateTime,
  formatLocalTime,
  readError,
  type UpcomingClass,
  type UpcomingResponse,
} from "@/components/classes/class-types"

const TICK_MS = 30_000
const COMPACT_LIMIT = 3
const DEFAULT_DURATION = 60

interface UpcomingClassesProps {
  /** Dashboard variant: max 3 items + a "View all" link. */
  compact?: boolean
  viewAllHref?: string
  className?: string
}

function relativeLabel(item: UpcomingClass, now: Date): string {
  const start = new Date(item.scheduled_at).getTime()
  const end = start + (item.duration_minutes ?? DEFAULT_DURATION) * 60_000
  const t = now.getTime()
  if (item.status === "live" || (t >= start && t <= end)) return "Live now"
  if (t > end) return "Ended"
  const mins = Math.round((start - t) / 60_000)
  if (mins < 60) return `in ${Math.max(mins, 1)} min`
  const hours = mins / 60
  if (hours < 24) return `in ${Math.round(hours)} h`
  return `in ${Math.round(hours / 24)} d`
}

export function UpcomingClasses({ compact = false, viewAllHref = "/parent/timetable", className }: UpcomingClassesProps) {
  const [items, setItems] = useState<UpcomingClass[] | null>(null)
  const [skewMs, setSkewMs] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch("/api/classes/upcoming", { cache: "no-store" })
      if (!res.ok) throw new Error(await readError(res, "Could not load your classes"))
      const json = (await res.json()) as UpcomingResponse
      const serverNow = Date.parse(json.serverNow)
      setSkewMs(Number.isNaN(serverNow) ? 0 : serverNow - Date.now())
      setItems(json.items)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load your classes")
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  // `tick` is a dependency so "now" is re-evaluated every 30 s.
  const now = useMemo(() => new Date(Date.now() + skewMs), [skewMs, tick]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = items ? (compact ? items.slice(0, COMPACT_LIMIT) : items) : []

  return (
    <section className={cn("rounded-lg border border-border bg-surface p-4 sm:p-5", className)} aria-label="Upcoming classes">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Upcoming classes</h3>
        {compact && items && items.length > 0 && (
          <Link href={viewAllHref} className="text-xs text-accent-secondary hover:underline">
            View all
          </Link>
        )}
      </div>

      <div className="mt-4">
        {error ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-sm text-accent-danger">
            <span>{error}</span>
            <button type="button" onClick={() => void load()} className="underline">
              Retry
            </button>
          </div>
        ) : items === null ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-surface-elevated" />
            ))}
            <span className="sr-only">Loading classes</span>
          </div>
        ) : shown.length === 0 ? (
          <p className="text-sm text-text-muted">No classes scheduled in the next 7 days.</p>
        ) : (
          <ul className="space-y-2">
            {shown.map((item) => {
              const open = isWithinJoinWindow(item, now)
              const opensAt = joinWindow(item).opensAt
              const closed = !open && now.getTime() > joinWindow(item).closesAt.getTime()
              const live = relativeLabel(item, now) === "Live now"
              return (
                <li
                  key={item.id}
                  data-testid="upcoming-class"
                  className="flex flex-col gap-3 rounded-lg border border-border bg-surface-elevated p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">{item.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-xs tabular-nums text-text-muted">
                      <span>{formatLocalDateTime(item.scheduled_at)}</span>
                      <span className={cn(live ? "text-accent-success" : "text-text-muted")}>{relativeLabel(item, now)}</span>
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-text-muted">
                      {item.isHost ? (
                        <>
                          <Users className="h-3 w-3" aria-hidden="true" />
                          {item.studentCount} {item.studentCount === 1 ? "student" : "students"}
                        </>
                      ) : (
                        item.teacherName && <>with {item.teacherName}</>
                      )}
                    </p>
                  </div>
                  {open ? (
                    <Link
                      href={`/meet/${item.id}`}
                      className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-[#08090C] [background:linear-gradient(110deg,#27C4A0,#5AD1B0_40%,#F5B84E)] hover:brightness-110"
                    >
                      <Video className="h-4 w-4" aria-hidden="true" /> Join
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-border px-4 text-xs text-text-muted opacity-70"
                    >
                      {closed ? "Closed" : `Opens at ${formatLocalTime(opensAt)}`}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
