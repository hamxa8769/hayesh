"use client"

import { useMemo } from "react"
import { Calendar as CalendarIcon, GraduationCap, Users, Video } from "lucide-react"
import { cn } from "@/lib/utils/cn"

/** Normalized shape shared by the demo-request agenda and this calendar. */
export interface AgendaItem {
  id: string
  kind: "demo" | "session" | "meeting"
  time: string
  title: string
  subtitle?: string
  status?: string | null
  meetingId?: string | null
}

const KIND_ICON: Record<AgendaItem["kind"], typeof CalendarIcon> = {
  demo: Users,
  session: GraduationCap,
  meeting: Video,
}

const DAY_WINDOW = 7

/** `in 45m` / `in 3h` / `in 2d` / `12m ago` — computed fresh on every render. */
export function formatRelativeCountdown(iso: string): string {
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return ""
  const diffMs = target - Date.now()
  const isPast = diffMs < 0
  const abs = Math.abs(diffMs)
  const minutes = Math.round(abs / 60_000)

  if (minutes < 1) return isPast ? "Just wrapped up" : "Starting now"
  if (minutes < 60) return isPast ? `${minutes}m ago` : `in ${minutes}m`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return isPast ? `${hours}h ago` : `in ${hours}h`

  const days = Math.round(hours / 24)
  return isPast ? `${days}d ago` : `in ${days}d`
}

function startOfDay(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function dayKey(iso: string): string {
  return startOfDay(new Date(iso)).toISOString()
}

export interface SessionsCalendarProps {
  items: AgendaItem[]
  className?: string
}

export function SessionsCalendar({ items, className }: SessionsCalendarProps) {
  const { days, overflowCount } = useMemo(() => {
    const today = startOfDay(new Date())
    const windowEnd = new Date(today)
    windowEnd.setDate(windowEnd.getDate() + DAY_WINDOW)

    const buckets = new Map<string, AgendaItem[]>()
    const dayList: { key: string; date: Date }[] = []
    for (let i = 0; i < DAY_WINDOW; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() + i)
      const key = date.toISOString()
      dayList.push({ key, date })
      buckets.set(key, [])
    }

    let overflow = 0
    for (const item of items) {
      const key = dayKey(item.time)
      const bucket = buckets.get(key)
      if (bucket) {
        bucket.push(item)
      } else if (new Date(item.time).getTime() >= windowEnd.getTime()) {
        overflow += 1
      }
    }

    for (const bucket of buckets.values()) {
      bucket.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    }

    return {
      days: dayList.map(({ key, date }) => ({ date, items: buckets.get(key) ?? [] })),
      overflowCount: overflow,
    }
  }, [items])

  const flatSorted = useMemo(
    () => [...items].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()),
    [items]
  )

  if (items.length === 0) {
    return (
      <div className={cn("rounded-lg border border-border bg-surface p-6 text-center", className)}>
        <CalendarIcon className="mx-auto mb-2 h-8 w-8 text-text-disabled" />
        <p className="text-sm text-text-muted">Nothing on the calendar for the next {DAY_WINDOW} days.</p>
      </div>
    )
  }

  return (
    <div className={cn("rounded-lg border border-border bg-surface p-3 sm:p-4", className)}>
      {/* Desktop / tablet: 7-day agenda grid. */}
      <div className="hidden overflow-x-auto sm:block">
        <div className="grid min-w-[640px] grid-cols-7 gap-2">
          {days.map(({ date, items: dayItems }) => {
            const isToday = date.getTime() === startOfDay(new Date()).getTime()
            return (
              <div
                key={date.toISOString()}
                className={cn(
                  "min-h-[7rem] rounded-md border border-border bg-surface-elevated p-2",
                  isToday && "border-line-strong"
                )}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
                  {date.toLocaleDateString(undefined, { weekday: "short" })}
                </p>
                <p
                  className={cn(
                    "font-mono text-sm font-semibold tabular-nums",
                    isToday ? "text-accent-primary" : "text-text-primary"
                  )}
                >
                  {date.getDate()}
                </p>
                <div className="mt-1.5 space-y-1">
                  {dayItems.slice(0, 3).map((item) => {
                    const Icon = KIND_ICON[item.kind]
                    return (
                      <div
                        key={item.id}
                        title={item.title}
                        className="flex items-center gap-1 truncate rounded border border-border bg-surface px-1.5 py-1 text-[11px] text-text-muted"
                      >
                        <Icon className="h-3 w-3 shrink-0 text-accent-primary" />
                        <span className="truncate">{item.title}</span>
                      </div>
                    )
                  })}
                  {dayItems.length > 3 && (
                    <p className="px-1 font-mono text-[10px] text-text-disabled">+{dayItems.length - 3} more</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Mobile: simple flat agenda list, ordered by time. */}
      <div className="space-y-2 sm:hidden">
        {flatSorted.slice(0, 8).map((item) => {
          const Icon = KIND_ICON[item.kind]
          return (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-md border border-border bg-surface-elevated px-3 py-2"
            >
              <Icon className="h-4 w-4 shrink-0 text-accent-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-text-primary">{item.title}</p>
              </div>
              <span className="shrink-0 font-mono text-xs tabular-nums text-text-muted">
                {formatRelativeCountdown(item.time)}
              </span>
            </div>
          )
        })}
      </div>

      {overflowCount > 0 && (
        <p className="mt-2 text-center font-mono text-xs text-text-disabled">
          +{overflowCount} more beyond the next {DAY_WINDOW} days
        </p>
      )}
    </div>
  )
}
