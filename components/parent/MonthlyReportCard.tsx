"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils/cn"
import { formatDate } from "@/lib/utils/format"

export interface MonthlyReportCardProps {
  userId: string
  studentId: string
  childName: string
}

interface SessionRow {
  status: string | null
  scheduled_at: string
}

interface AssignmentRow {
  status: string
  grade: string | null
}

interface NoteRow {
  id: string
  body: string
  created_at: string | null
}

interface ReportData {
  sessions: SessionRow[]
  assignments: AssignmentRow[]
  notes: NoteRow[]
}

const MONTH_OPTIONS = 6
const NOTE_PREVIEW = 90
const NOTES_SHOWN = 3

function monthStart(offset: number): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() - offset, 1)
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

/** Grades are free text ("85", "85/100", "92%", "A"); only numeric ones average. */
function parseNumericGrade(grade: string | null): number | null {
  if (!grade) return null
  const match = grade.match(/^\s*(\d+(?:\.\d+)?)\s*(?:%|\/\s*(\d+(?:\.\d+)?))?\s*$/)
  if (!match) return null
  const value = Number(match[1])
  const outOf = match[2] ? Number(match[2]) : 100
  if (!Number.isFinite(value) || !Number.isFinite(outOf) || outOf <= 0) return null
  return (value / outOf) * 100
}

function summarize(attendancePct: number | null, assigned: number, submitted: number): string {
  const parts: string[] = []
  if (attendancePct !== null) parts.push(`${attendancePct}% attendance`)
  if (assigned > 0) parts.push(`${submitted}/${assigned} assignments submitted`)
  if (parts.length === 0) return "No activity recorded this month."

  const attendanceOk = attendancePct === null || attendancePct >= 80
  const submissionRatio = assigned > 0 ? submitted / assigned : 1
  const headline =
    attendanceOk && submissionRatio >= 0.7
      ? "Strong month"
      : (attendancePct ?? 100) >= 60 && submissionRatio >= 0.4
        ? "Steady month"
        : "Needs attention"
  return `${headline} — ${parts.join(", ")}`
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-elevated p-4">
      <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-text-primary">{value}</p>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  )
}

export function MonthlyReportCard({ userId, studentId, childName }: MonthlyReportCardProps) {
  const months = useMemo(() => Array.from({ length: MONTH_OPTIONS }, (_, i) => monthStart(i)), [])
  const [monthIndex, setMonthIndex] = useState(0)
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const start = months[monthIndex]
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
      const from = start.toISOString()
      const to = end.toISOString()

      const [sessionsRes, assignmentsRes, notesRes] = await Promise.all([
        // Teacher lessons are written to public.sessions (parent_id + child_name);
        // public.meetings has no child reference so it is not used here.
        supabase
          .from("sessions")
          .select("status, scheduled_at")
          .eq("parent_id", userId)
          .eq("child_name", childName)
          .gte("scheduled_at", from)
          .lt("scheduled_at", to),
        supabase
          .from("assignments")
          .select("status, grade")
          .eq("student_id", studentId)
          .gte("created_at", from)
          .lt("created_at", to),
        supabase
          .from("teacher_notes")
          .select("id, body, created_at")
          .eq("student_id", studentId)
          .eq("parent_id", userId)
          .eq("is_private", false)
          .gte("created_at", from)
          .lt("created_at", to)
          .order("created_at", { ascending: false })
          .limit(NOTES_SHOWN),
      ])

      const failure = sessionsRes.error ?? assignmentsRes.error ?? notesRes.error
      if (failure) {
        setError(failure.message)
        return
      }
      setData({
        sessions: (sessionsRes.data ?? []) as SessionRow[],
        assignments: (assignmentsRes.data ?? []) as AssignmentRow[],
        notes: (notesRes.data ?? []) as NoteRow[],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the monthly report. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [months, monthIndex, userId, studentId, childName])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    if (!data) return null
    const now = Date.now()
    // A lesson counts as "due" once it has happened or been marked; cancelled and future ones don't.
    const due = data.sessions.filter(
      (s) => s.status !== "cancelled" && (s.status !== "scheduled" || new Date(s.scheduled_at).getTime() <= now)
    )
    const attended = due.filter((s) => s.status === "completed").length
    const attendancePct = due.length > 0 ? Math.round((attended / due.length) * 100) : null

    const assigned = data.assignments.length
    const submitted = data.assignments.filter((a) => a.status === "submitted" || a.status === "graded").length
    const graded = data.assignments.filter((a) => a.status === "graded").length
    const grades = data.assignments
      .map((a) => parseNumericGrade(a.grade))
      .filter((g): g is number => g !== null)
    const avgGrade = grades.length > 0 ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) : null

    return {
      dueCount: due.length,
      attended,
      attendancePct,
      assigned,
      submitted,
      graded,
      avgGrade,
      isEmpty: data.sessions.length === 0 && assigned === 0 && data.notes.length === 0,
    }
  }, [data])

  return (
    <section className="space-y-4 rounded-lg border border-border bg-surface p-5" aria-label="Monthly report">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Monthly report</p>
          <h3 className="mt-1 font-display text-lg font-semibold text-text-primary">{childName}</h3>
        </div>
        <div className="flex max-w-full gap-1 overflow-x-auto" role="tablist" aria-label="Select a month">
          {months.map((m, i) => (
            <button
              key={m.toISOString()}
              type="button"
              role="tab"
              aria-selected={i === monthIndex}
              onClick={() => setMonthIndex(i)}
              className={cn(
                "shrink-0 rounded-lg border px-3 py-1 font-mono text-xs transition-colors duration-150",
                i === monthIndex
                  ? "border-accent-primary/40 bg-accent-primary/10 text-accent-primary"
                  : "border-border bg-surface-elevated text-text-muted hover:text-text-primary"
              )}
            >
              {m.toLocaleDateString("en-US", { month: "short", year: i === 0 ? undefined : "2-digit" })}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-surface-elevated/60" />
            ))}
          </div>
          <div className="h-10 animate-pulse rounded-lg bg-surface-elevated/60" />
        </div>
      ) : error ? (
        <div className="py-6 text-center">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-accent-danger" />
          <p className="text-sm text-text-primary">Couldn&apos;t load this report</p>
          <p className="mt-1 text-xs text-text-muted">{error}</p>
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={load}>
            Try Again
          </Button>
        </div>
      ) : !stats || !data || stats.isEmpty ? (
        <div className="py-6 text-center">
          <CalendarDays className="mx-auto mb-2 h-8 w-8 text-text-disabled" />
          <p className="text-sm text-text-primary">No activity recorded this month</p>
          <p className="mt-1 text-xs text-text-muted">{monthLabel(months[monthIndex])}</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-text-primary">{summarize(stats.attendancePct, stats.assigned, stats.submitted)}</p>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile
              label="Lessons"
              value={`${stats.attended}/${stats.dueCount}`}
              hint="attended / scheduled"
            />
            <Tile
              label="Attendance"
              value={stats.attendancePct === null ? "—" : `${stats.attendancePct}%`}
            />
            <Tile
              label="Assignments"
              value={`${stats.submitted}/${stats.assigned}`}
              hint={`${stats.graded} graded`}
            />
            <Tile
              label="Avg grade"
              value={stats.avgGrade === null ? "—" : `${stats.avgGrade}%`}
              hint={stats.avgGrade === null ? "No numeric grades" : undefined}
            />
          </div>

          <div>
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Latest teacher notes</p>
            {data.notes.length === 0 ? (
              <p className="mt-2 text-sm text-text-muted">No notes this month.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {data.notes.map((note) => (
                  <li key={note.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                    <span className="min-w-0 text-sm text-text-primary">
                      {note.body.length > NOTE_PREVIEW ? `${note.body.slice(0, NOTE_PREVIEW).trimEnd()}…` : note.body}
                    </span>
                    {note.created_at && (
                      <span className="font-mono text-xs tabular-nums text-text-muted">
                        {formatDate(note.created_at)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  )
}
