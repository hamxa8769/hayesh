"use client"

import { useEffect, useState } from "react"
import { Film } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useSupabase } from "@/hooks/useSupabase"
import { StatusPill, type PillTone } from "@/components/teacher/StatusPill"
import { cn } from "@/lib/utils/cn"
import { formatLocalDateTime } from "@/components/classes/class-types"

const HISTORY_DAYS = 30
const MS_PER_DAY = 86_400_000

interface PastMeeting {
  id: string
  title: string
  scheduled_at: string
  duration_minutes: number | null
  status: string
}

interface AttendanceRow {
  meeting_id: string
  profile_id: string
  joined_at: string
  left_at: string | null
}

interface RecordingRow {
  id: string
  meeting_id: string
  expires_at: string | null
}

interface PastClassesProps {
  /** "teacher": attendee counts. "parent": the viewer's own attendance + missed-class notices. */
  viewer: "teacher" | "parent"
  className?: string
}

const STATUS_META: Record<string, { label: string; tone: PillTone }> = {
  completed: { label: "Completed", tone: "success" },
  no_show_teacher: { label: "Teacher no-show", tone: "danger" },
  no_show_student: { label: "Student no-show", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  scheduled: { label: "Not held", tone: "neutral" },
  live: { label: "Ended", tone: "info" },
}

function minutesAttended(rows: AttendanceRow[]): number {
  let ms = 0
  for (const r of rows) {
    const start = Date.parse(r.joined_at)
    const end = r.left_at ? Date.parse(r.left_at) : start
    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) ms += end - start
  }
  return Math.round(ms / 60_000)
}

export function PastClasses({ viewer, className }: PastClassesProps) {
  const { user } = useSupabase()
  const [meetings, setMeetings] = useState<PastMeeting[] | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [recordings, setRecordings] = useState<RecordingRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const load = async () => {
      try {
        const supabase = createClient()
        const nowIso = new Date().toISOString()
        const sinceIso = new Date(Date.now() - HISTORY_DAYS * MS_PER_DAY).toISOString()
        let query = supabase
          .from("meetings")
          .select("id, title, scheduled_at, duration_minutes, status")
          .not("timetable_slot_id", "is", null)
          .gte("scheduled_at", sinceIso)
          .lt("scheduled_at", nowIso)
          .order("scheduled_at", { ascending: false })
          .limit(100)
        if (viewer === "teacher") query = query.eq("organizer_id", user.id)
        const { data, error: mErr } = await query
        if (mErr) throw new Error(mErr.message)
        const rows = (data ?? []) as PastMeeting[]
        const ids = rows.map((r) => r.id)

        let att: AttendanceRow[] = []
        let rec: RecordingRow[] = []
        if (ids.length > 0) {
          let attQuery = supabase.from("class_attendance").select("meeting_id, profile_id, joined_at, left_at").in("meeting_id", ids)
          if (viewer === "parent") attQuery = attQuery.eq("profile_id", user.id)
          const [attRes, recRes] = await Promise.all([
            attQuery,
            supabase.from("meeting_recordings").select("id, meeting_id, expires_at").eq("status", "ready").in("meeting_id", ids),
          ])
          att = (attRes.data ?? []) as AttendanceRow[]
          rec = (recRes.data ?? []) as RecordingRow[]
        }
        if (cancelled) return
        setMeetings(rows)
        setAttendance(att)
        setRecordings(rec)
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load past classes")
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user, viewer])

  return (
    <section className={cn("rounded-lg border border-border bg-surface p-4 sm:p-5", className)} aria-label="Past classes">
      <h3 className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Past classes · last {HISTORY_DAYS} days</h3>
      <div className="mt-4">
        {error ? (
          <p className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-sm text-accent-danger">{error}</p>
        ) : meetings === null ? (
          <div className="h-20 animate-pulse rounded-lg border border-border bg-surface-elevated" aria-busy="true" />
        ) : meetings.length === 0 ? (
          <p className="text-sm text-text-muted">No classes in the last {HISTORY_DAYS} days.</p>
        ) : (
          <ul className="space-y-2">
            {meetings.map((m) => {
              const meta = STATUS_META[m.status] ?? { label: m.status, tone: "neutral" as PillTone }
              const rows = attendance.filter((a) => a.meeting_id === m.id)
              const recording = recordings.find((r) => r.meeting_id === m.id)
              const attendees = new Set(rows.map((r) => r.profile_id).filter((id) => id !== user?.id)).size
              const mine = minutesAttended(rows.filter((r) => r.profile_id === user?.id))
              return (
                <li key={m.id} data-testid="past-class" className="rounded-lg border border-border bg-surface-elevated p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">{m.title}</p>
                      <p className="font-mono text-xs tabular-nums text-text-muted">{formatLocalDateTime(m.scheduled_at)}</p>
                    </div>
                    <StatusPill label={meta.label} tone={meta.tone} />
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-text-muted">
                    {viewer === "teacher" ? (
                      <p>
                        {attendees} {attendees === 1 ? "attendee" : "attendees"}
                      </p>
                    ) : (
                      <>
                        {m.status === "no_show_teacher" && (
                          <p className="text-accent-danger">Teacher missed this class — it will be credited</p>
                        )}
                        {mine > 0 ? <p>Attended {mine} min</p> : m.status === "completed" || m.status === "no_show_student" ? <p>Did not attend</p> : null}
                      </>
                    )}
                    {recording && (
                      <p className="flex flex-wrap items-center gap-x-2">
                        <a href={`/api/recordings/${recording.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-secondary hover:underline">
                          <Film className="h-3 w-3" aria-hidden="true" /> Watch recording
                        </a>
                        {recording.expires_at && (
                          <span>Available until {new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(recording.expires_at))}</span>
                        )}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
