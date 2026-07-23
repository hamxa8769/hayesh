"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { AlertTriangle, BookOpen, Megaphone } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { StatusPill, type PillTone } from "@/components/teacher/StatusPill"
import { useSupabase } from "@/hooks/useSupabase"
import { formatDate } from "@/lib/utils/format"
import type { Assignment, AnnouncementItem, SubmissionAttachment } from "@/components/parent/ProgressFeed"

interface SectionState<T> {
  data: T[]
  loading: boolean
  error: string | null
}

const emptySection = <T,>(): SectionState<T> => ({ data: [], loading: true, error: null })

const RECENT_ASSIGNMENTS_LIMIT = 4
const RECENT_ANNOUNCEMENTS_LIMIT = 3

const ASSIGNMENT_STATUS_TONE: Record<Assignment["status"], PillTone> = {
  assigned: "warning",
  submitted: "info",
  graded: "success",
}

const ASSIGNMENT_STATUS_LABEL: Record<Assignment["status"], string> = {
  assigned: "Assigned",
  submitted: "Submitted",
  graded: "Graded",
}

/** Raw shape of a `assignments` row as returned by Supabase for this query, before normalization. */
interface RawAssignmentRow {
  id: string
  teacher_id: string
  student_id: string
  title: string
  instructions: string | null
  subject: string | null
  due_date: string | null
  status: Assignment["status"]
  submitted_at: string | null
  submission_attachments: SubmissionAttachment[] | null
  grade: string | null
  feedback: string | null
  created_at: string | null
  // A many-to-one embed (teacher_id -> teachers.id) resolves to a single row at
  // runtime, but supabase-js's inferred type (no generated Database schema in
  // this project yet) can present it as an array — normalize defensively
  // rather than trust either shape blindly.
  teachers: { display_name: string } | { display_name: string }[] | null
}

function normalizeAssignmentRow(row: RawAssignmentRow): Assignment {
  const teachers = Array.isArray(row.teachers) ? (row.teachers[0] ?? null) : row.teachers
  return { ...row, teachers }
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-surface-elevated/60" />
      ))}
    </div>
  )
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-border p-4 text-center">
      <AlertTriangle className="mx-auto mb-1 h-5 w-5 text-accent-danger" />
      <p className="text-xs text-text-muted">{message}</p>
    </div>
  )
}

function InlineEmpty({ message }: { message: string }) {
  return <p className="rounded-lg border border-border p-4 text-center text-sm text-text-muted">{message}</p>
}

/**
 * Compact homework + announcements widget for /parent/dashboard. Pulls the
 * same shapes ProgressFeed uses on /parent/progress (assignments across all
 * of the parent's children, most recent announcements) but trimmed to a
 * short list, so the dashboard surfaces this content instead of leaving it
 * only reachable from the Progress tab.
 */
export function DashboardFeed() {
  const { user } = useSupabase()
  const prefersReducedMotion = useReducedMotion()
  const [assignments, setAssignments] = useState<SectionState<Assignment>>(emptySection())
  const [announcements, setAnnouncements] = useState<SectionState<AnnouncementItem>>(emptySection())

  const loadAssignments = useCallback(async () => {
    if (!user) return
    setAssignments((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select("id")
        .eq("parent_id", user.id)

      if (studentsError) {
        setAssignments({ data: [], loading: false, error: studentsError.message })
        return
      }

      const studentIds = (students || []).map((s) => s.id as string)
      if (studentIds.length === 0) {
        setAssignments({ data: [], loading: false, error: null })
        return
      }

      const { data, error } = await supabase
        .from("assignments")
        .select("*, teachers(display_name)")
        .in("student_id", studentIds)
        .order("created_at", { ascending: false })
        .limit(RECENT_ASSIGNMENTS_LIMIT)

      if (error) {
        setAssignments({ data: [], loading: false, error: error.message })
        return
      }

      const rows = (data || []) as unknown as RawAssignmentRow[]
      setAssignments({ data: rows.map(normalizeAssignmentRow), loading: false, error: null })
    } catch (e) {
      setAssignments({
        data: [],
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load homework. Please try again.",
      })
    }
  }, [user])

  const loadAnnouncements = useCallback(async () => {
    setAnnouncements((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data, error } = await supabase
        .from("announcements")
        .select("id, author_id, title, body, published_at")
        .order("published_at", { ascending: false })
        .limit(RECENT_ANNOUNCEMENTS_LIMIT)

      if (error) {
        setAnnouncements({ data: [], loading: false, error: error.message })
        return
      }

      const rows = data || []
      const authorIds = Array.from(new Set(rows.map((r) => r.author_id)))
      const authorNames = new Map<string, string>()
      if (authorIds.length > 0) {
        const { data: profileRows } = await supabase.from("profiles").select("id, full_name").in("id", authorIds)
        for (const p of profileRows || []) {
          authorNames.set(p.id, p.full_name)
        }
      }

      setAnnouncements({
        data: rows.map((r) => ({
          id: r.id,
          title: r.title,
          body: r.body,
          published_at: r.published_at,
          authorName: authorNames.get(r.author_id) ?? "Your teacher",
        })),
        loading: false,
        error: null,
      })
    } catch (e) {
      setAnnouncements({
        data: [],
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load announcements. Please try again.",
      })
    }
  }, [])

  useEffect(() => {
    loadAssignments()
  }, [loadAssignments])

  useEffect(() => {
    loadAnnouncements()
  }, [loadAnnouncements])

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <JarvisCard glow="none" className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-accent-primary" />
            <h3 className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Recent Homework</h3>
          </div>
          <Link href="/parent/progress" className="text-xs text-accent-primary hover:underline">
            View all
          </Link>
        </div>

        <div className="mt-4">
          {assignments.loading ? (
            <SkeletonRows count={2} />
          ) : assignments.error ? (
            <InlineError message={assignments.error} />
          ) : assignments.data.length === 0 ? (
            <InlineEmpty message="No homework yet." />
          ) : (
            <div className="space-y-2">
              {assignments.data.map((assignment, i) => (
                <motion.div
                  key={assignment.id}
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: i * 0.04 }}
                >
                  <Link
                    href="/parent/progress"
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors duration-300 hover:bg-surface-elevated"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">{assignment.title}</p>
                      <p className="mt-0.5 truncate text-xs text-text-muted">
                        {assignment.teachers?.display_name ?? "Teacher"}
                        {assignment.due_date ? ` · Due ${formatDate(assignment.due_date)}` : ""}
                      </p>
                    </div>
                    <StatusPill
                      label={ASSIGNMENT_STATUS_LABEL[assignment.status]}
                      tone={ASSIGNMENT_STATUS_TONE[assignment.status]}
                    />
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </JarvisCard>

      <JarvisCard glow="none" className="p-5">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-accent-primary" />
          <h3 className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Announcements</h3>
        </div>

        <div className="mt-4">
          {announcements.loading ? (
            <SkeletonRows count={2} />
          ) : announcements.error ? (
            <InlineError message={announcements.error} />
          ) : announcements.data.length === 0 ? (
            <InlineEmpty message="No announcements right now." />
          ) : (
            <div className="space-y-2">
              {announcements.data.map((announcement, i) => (
                <motion.div
                  key={announcement.id}
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: i * 0.04 }}
                >
                  <Link
                    href="/parent/progress"
                    className="block rounded-lg border border-border p-3 transition-colors duration-300 hover:bg-surface-elevated"
                  >
                    <p className="truncate text-sm font-medium text-text-primary">{announcement.title}</p>
                    <p className="mt-0.5 truncate text-xs text-text-muted">
                      {announcement.authorName}
                      {announcement.published_at ? ` · ${formatDate(announcement.published_at)}` : ""}
                    </p>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </JarvisCard>
    </div>
  )
}
