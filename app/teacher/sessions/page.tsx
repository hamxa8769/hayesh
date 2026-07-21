"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Bell,
  Calendar,
  ChevronDown,
  Clock,
  GraduationCap,
  Loader2,
  Users,
  Video,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/motion/Reveal"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { cn } from "@/lib/utils/cn"
import { useSupabase } from "@/hooks/useSupabase"
import { formatDateTime } from "@/lib/utils/format"
import { DemoRequestCard, StatusPill } from "@/components/teacher/DemoRequestCard"
import {
  ScheduleMeetingModal,
  type ScheduledMeetingResult,
} from "@/components/teacher/ScheduleMeetingModal"
import {
  SessionsCalendar,
  formatRelativeCountdown,
  type AgendaItem,
} from "@/components/teacher/SessionsCalendar"
import type { DemoBooking, Session } from "@/types/database"

/**
 * public.meetings is not yet mirrored in types/database.ts (migration 011
 * added the table but the hand-maintained type file was never updated for
 * it). Typed locally here rather than editing that shared file, which is
 * out of scope for this change.
 */
interface MeetingRow {
  id: string
  organizer_id: string
  participant_id: string
  context: "tutoring" | "gig"
  related_id: string | null
  title: string
  agenda: string | null
  scheduled_at: string
  duration_minutes: number | null
  room_url: string | null
  status: "scheduled" | "completed" | "cancelled"
  created_at: string | null
  updated_at: string | null
}

type BookingAction = "confirm" | "decline" | "complete"

interface PatchResult {
  ok: boolean
  error?: string
}

const COUNTDOWN_TICK_MS = 60_000

export default function SessionsPage() {
  const { user } = useSupabase()

  const [loading, setLoading] = useState(true)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [partialError, setPartialError] = useState<string | null>(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  const [demoBookings, setDemoBookings] = useState<DemoBooking[]>([])
  const [meetings, setMeetings] = useState<MeetingRow[]>([])
  const [sessions, setSessions] = useState<Session[]>([])

  const [showPast, setShowPast] = useState(false)
  const [scheduleTarget, setScheduleTarget] = useState<DemoBooking | null>(null)
  const [actioning, setActioning] = useState<{ id: string; action: BookingAction } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Forces relative-countdown text to refresh periodically without
  // recomputing the memoized agenda lists themselves.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), COUNTDOWN_TICK_MS)
    return () => clearInterval(id)
  }, [])

  const load = async () => {
    if (!user) return
    setFatalError(null)
    setPartialError(null)

    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      // demo_bookings/sessions.teacher_id reference teachers(id), not
      // auth.uid() — resolve the teacher row first. `.maybeSingle()` (not
      // `.single()`) because a signed-in teacher who hasn't finished
      // onboarding legitimately has zero rows here.
      const { data: teacherRow, error: teacherError } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (teacherError) {
        setFatalError("We couldn't load your teacher profile. Please try again.")
        setLoading(false)
        return
      }

      if (!teacherRow) {
        setNeedsOnboarding(true)
        setLoading(false)
        return
      }

      const id = (teacherRow as { id: string }).id

      const [demoRes, meetingsRes, sessionsRes] = await Promise.all([
        supabase
          .from("demo_bookings")
          .select("*")
          .eq("teacher_id", id)
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("meetings")
          .select("*")
          .or(`organizer_id.eq.${user.id},participant_id.eq.${user.id}`)
          .eq("context", "tutoring")
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("sessions")
          .select("*")
          .eq("teacher_id", id)
          .order("scheduled_at", { ascending: false }),
      ])

      const errors: string[] = []
      if (demoRes.error) errors.push(`demo requests (${demoRes.error.message})`)
      if (meetingsRes.error) errors.push(`meetings (${meetingsRes.error.message})`)
      if (sessionsRes.error) errors.push(`sessions (${sessionsRes.error.message})`)
      setPartialError(errors.length > 0 ? `Some data failed to load: ${errors.join(", ")}` : null)

      setDemoBookings((demoRes.data ?? []) as DemoBooking[])
      setMeetings((meetingsRes.data ?? []) as MeetingRow[])
      setSessions((sessionsRes.data ?? []) as Session[])
      setLoading(false)
    } catch (e) {
      setFatalError(e instanceof Error ? e.message : "We couldn't load your sessions. Please try again.")
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const patchBooking = async (bookingId: string, action: BookingAction): Promise<PatchResult> => {
    try {
      const res = await fetch("/api/teacher/demo-bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, action }),
      })
      const payload: unknown = await res.json().catch(() => null)

      if (!res.ok) {
        const message =
          payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error: string }).error
            : "That request failed. Please try again."
        return { ok: false, error: message }
      }

      const booking = (payload as { booking: DemoBooking }).booking
      setDemoBookings((prev) => prev.map((b) => (b.id === booking.id ? booking : b)))
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Network error. Please try again." }
    }
  }

  const runAction = async (bookingId: string, action: BookingAction) => {
    setActioning({ id: bookingId, action })
    setActionError(null)
    const result = await patchBooking(bookingId, action)
    if (!result.ok) setActionError(result.error ?? "That request failed.")
    setActioning(null)
  }

  const handleScheduled = async (_meeting: ScheduledMeetingResult) => {
    if (scheduleTarget && scheduleTarget.status === "pending") {
      await patchBooking(scheduleTarget.id, "confirm")
    }
    await load()
  }

  const bookingsById = useMemo(() => new Map(demoBookings.map((b) => [b.id, b])), [demoBookings])
  const sessionsById = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions])

  const pendingBookings = useMemo(
    () =>
      demoBookings
        .filter((b) => b.status === "pending")
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
    [demoBookings]
  )

  const meetingsByRelatedId = useMemo(() => {
    const map = new Map<string, MeetingRow>()
    for (const meeting of meetings) {
      if (!meeting.related_id) continue
      const existing = map.get(meeting.related_id)
      if (!existing || new Date(meeting.scheduled_at) < new Date(existing.scheduled_at)) {
        map.set(meeting.related_id, meeting)
      }
    }
    return map
  }, [meetings])

  const upcomingAgenda = useMemo<AgendaItem[]>(() => {
    const consumedMeetingIds = new Set([...meetingsByRelatedId.values()].map((m) => m.id))
    const items: AgendaItem[] = []

    for (const b of demoBookings) {
      if (b.status !== "confirmed") continue
      const meeting = meetingsByRelatedId.get(b.id)
      items.push({
        id: b.id,
        kind: "demo",
        time: b.scheduled_at,
        title: `${b.child_name} · ${b.subject}`,
        subtitle: "Demo lesson",
        status: b.status,
        meetingId: meeting && meeting.status === "scheduled" ? meeting.id : null,
      })
    }

    for (const s of sessions) {
      if (s.status !== "scheduled") continue
      items.push({
        id: s.id,
        kind: "session",
        time: s.scheduled_at,
        title: s.subject || "Session",
        subtitle: s.child_name,
        status: s.status,
        meetingId: null,
      })
    }

    for (const m of meetings) {
      if (m.status !== "scheduled") continue
      if (consumedMeetingIds.has(m.id)) continue
      items.push({ id: m.id, kind: "meeting", time: m.scheduled_at, title: m.title, status: m.status, meetingId: m.id })
    }

    return items.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
  }, [demoBookings, sessions, meetings, meetingsByRelatedId])

  const pastAgenda = useMemo<AgendaItem[]>(() => {
    const consumedMeetingIds = new Set([...meetingsByRelatedId.values()].map((m) => m.id))
    const items: AgendaItem[] = []

    for (const b of demoBookings) {
      if (b.status !== "completed" && b.status !== "cancelled") continue
      items.push({
        id: b.id,
        kind: "demo",
        time: b.scheduled_at,
        title: `${b.child_name} · ${b.subject}`,
        subtitle: "Demo lesson",
        status: b.status,
        meetingId: null,
      })
    }

    for (const s of sessions) {
      if (s.status !== "completed" && s.status !== "cancelled" && s.status !== "no_show") continue
      items.push({
        id: s.id,
        kind: "session",
        time: s.scheduled_at,
        title: s.subject || "Session",
        subtitle: s.child_name,
        status: s.status,
        meetingId: null,
      })
    }

    for (const m of meetings) {
      if (m.status !== "completed" && m.status !== "cancelled") continue
      if (consumedMeetingIds.has(m.id)) continue
      items.push({ id: m.id, kind: "meeting", time: m.scheduled_at, title: m.title, status: m.status, meetingId: null })
    }

    return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  }, [demoBookings, sessions, meetings, meetingsByRelatedId])

  const scheduleModalBooking = useMemo(
    () =>
      scheduleTarget
        ? {
            id: scheduleTarget.id,
            parent_id: scheduleTarget.parent_id,
            child_name: scheduleTarget.child_name,
            subject: scheduleTarget.subject,
            notes: scheduleTarget.notes,
          }
        : null,
    [scheduleTarget]
  )

  if (fatalError) {
    return (
      <div className="space-y-6">
        <Reveal>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text-primary">Sessions</h2>
        </Reveal>
        <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-6 text-sm text-accent-danger">
          {fatalError}
        </div>
      </div>
    )
  }

  if (!loading && needsOnboarding) {
    return (
      <div className="space-y-6">
        <Reveal>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text-primary">Sessions</h2>
        </Reveal>
        <div className="relative overflow-hidden rounded-lg border border-border bg-surface p-8">
          <span aria-hidden="true" className="aurora-bg absolute inset-x-0 top-0 h-[2px]" />
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-surface-elevated">
                <GraduationCap className="h-6 w-6 text-accent-primary" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold tracking-[-0.02em] text-text-primary">
                  Complete your teacher profile
                </h3>
                <p className="mt-1 max-w-md text-sm text-text-muted">
                  Demo requests and sessions will show up here once your teacher profile is set up.
                </p>
              </div>
            </div>
            <Link href="/teacher/onboarding" className="shrink-0">
              <Button variant="aurora">Start Onboarding</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <Reveal>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text-primary">Sessions</h2>
        <p className="mt-1 text-text-muted">Demo requests, upcoming lessons, and your session history.</p>
      </Reveal>

      {partialError && (
        <div className="rounded-lg border border-accent-warning/30 bg-accent-warning/10 p-3 text-sm text-accent-warning">
          {partialError}
        </div>
      )}
      {actionError && (
        <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-3 text-sm text-accent-danger">
          {actionError}
        </div>
      )}

      {!loading && pendingBookings.length > 0 && (
        <Reveal>
          <div className="relative overflow-hidden rounded-lg border border-accent-warning/30 bg-accent-warning/5 p-4 sm:p-5">
            <span aria-hidden="true" className="aurora-bg absolute inset-x-0 top-0 h-[2px]" />
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accent-warning/30 bg-accent-warning/10">
                <Bell className="h-5 w-5 text-accent-warning" />
              </div>
              <div>
                <p className="font-display text-base font-semibold tabular-nums text-text-primary">
                  {pendingBookings.length} demo request{pendingBookings.length === 1 ? "" : "s"} waiting on you
                </p>
                <p className="text-sm text-text-muted">
                  Confirm or decline below, or schedule the video meeting directly.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      )}

      {/* ── PENDING DEMO REQUESTS ───────────────────────────── */}
      <section>
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
          Pending Demo Requests
        </p>
        {loading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-lg border border-border bg-surface" />
            ))}
          </div>
        ) : pendingBookings.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-8 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-text-disabled" />
            <p className="text-text-muted">
              {demoBookings.length === 0
                ? "No demo requests yet. Once a parent books a free demo with you, it'll show up here."
                : "You're all caught up — no pending demo requests."}
            </p>
          </div>
        ) : (
          <PanelGroup className="space-y-3">
            {pendingBookings.map((booking) => (
              <DemoRequestCard
                key={booking.id}
                booking={booking}
                isConfirming={actioning?.id === booking.id && actioning.action === "confirm"}
                isDeclining={actioning?.id === booking.id && actioning.action === "decline"}
                onConfirm={() => runAction(booking.id, "confirm")}
                onDecline={() => runAction(booking.id, "decline")}
                onScheduleMeeting={() => setScheduleTarget(booking)}
              />
            ))}
          </PanelGroup>
        )}
      </section>

      {/* ── UPCOMING ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Upcoming</p>

        {loading ? (
          <div className="h-40 animate-pulse rounded-lg border border-border bg-surface" />
        ) : (
          <>
            <SessionsCalendar items={upcomingAgenda} />

            {upcomingAgenda.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface p-8 text-center">
                <Calendar className="mx-auto mb-3 h-10 w-10 text-text-disabled" />
                <p className="text-text-muted">Nothing scheduled yet.</p>
              </div>
            ) : (
              <PanelGroup className="space-y-3">
                {upcomingAgenda.map((item) => {
                  const booking = item.kind === "demo" ? bookingsById.get(item.id) : undefined
                  const session = item.kind === "session" ? sessionsById.get(item.id) : undefined
                  const sessionJoinUrl = session?.livekit_room || null
                  const isCompleting = actioning?.id === item.id && actioning.action === "complete"

                  return (
                    <div
                      key={`${item.kind}-${item.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-line-strong"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Calendar className="h-5 w-5 shrink-0 text-accent-primary" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-text-primary">{item.title}</p>
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-xs tabular-nums text-text-muted">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {formatDateTime(item.time)}
                            </span>
                            <span className="text-text-disabled">{formatRelativeCountdown(item.time)}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <StatusPill status={item.status} />

                        {item.kind === "demo" && booking && !item.meetingId && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => setScheduleTarget(booking)}
                          >
                            <Video className="h-3.5 w-3.5" /> Schedule
                          </Button>
                        )}

                        {item.kind === "demo" && booking && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => runAction(booking.id, "complete")}
                            disabled={isCompleting}
                          >
                            {isCompleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Mark completed
                          </Button>
                        )}

                        {item.meetingId && (
                          <a href={`/meet/${item.meetingId}`} target="_blank" rel="noopener noreferrer">
                            <span className="flex items-center gap-1.5 rounded-lg border border-accent-primary/30 bg-accent-primary/10 px-3 py-1.5 text-xs font-medium text-accent-primary transition-colors hover:bg-accent-primary/20">
                              <Video className="h-3.5 w-3.5" /> Join
                            </span>
                          </a>
                        )}

                        {item.kind === "session" && sessionJoinUrl && (
                          <a href={sessionJoinUrl} target="_blank" rel="noopener noreferrer">
                            <span className="flex items-center gap-1.5 rounded-lg border border-accent-primary/30 bg-accent-primary/10 px-3 py-1.5 text-xs font-medium text-accent-primary transition-colors hover:bg-accent-primary/20">
                              <Video className="h-3.5 w-3.5" /> Join
                            </span>
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </PanelGroup>
            )}
          </>
        )}
      </section>

      {/* ── PAST ─────────────────────────────────────────────── */}
      <section>
        <button
          type="button"
          onClick={() => setShowPast((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-line-strong"
        >
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
            Past {pastAgenda.length > 0 && `(${pastAgenda.length})`}
          </span>
          <ChevronDown className={cn("h-4 w-4 text-text-muted transition-transform", showPast && "rotate-180")} />
        </button>

        {showPast && (
          <div className="mt-3">
            {loading ? (
              <div className="h-24 animate-pulse rounded-lg border border-border bg-surface" />
            ) : pastAgenda.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface p-6 text-center">
                <p className="text-sm text-text-muted">Nothing here yet.</p>
              </div>
            ) : (
              <PanelGroup className="space-y-2">
                {pastAgenda.map((item) => (
                  <div
                    key={`${item.kind}-${item.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 opacity-80"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-text-primary">{item.title}</p>
                      <p className="font-mono text-xs tabular-nums text-text-muted">{formatDateTime(item.time)}</p>
                    </div>
                    <StatusPill status={item.status} />
                  </div>
                ))}
              </PanelGroup>
            )}
          </div>
        )}
      </section>

      <ScheduleMeetingModal
        open={scheduleTarget !== null}
        onClose={() => setScheduleTarget(null)}
        booking={scheduleModalBooking}
        onScheduled={handleScheduled}
      />
    </div>
  )
}
