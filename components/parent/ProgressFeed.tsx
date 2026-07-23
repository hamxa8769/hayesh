"use client"

import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { AlertTriangle, BookOpen, Megaphone, MessageSquare, Paperclip, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { StatusPill, type PillTone } from "@/components/teacher/StatusPill"
import { formatDate, formatDateTime } from "@/lib/utils/format"
import type { StudentProgress } from "@/types/database"

/**
 * One entry of `assignments.submission_attachments` (jsonb, migration 011).
 * A "file" entry points at an object in the private `homework-submissions`
 * bucket (migration 012) at `${student_id}/${assignment_id}/${filename}`; a
 * "note" entry is the free-text note the parent left. Both may be present.
 */
export type SubmissionAttachment =
  | { type: "note"; text: string; created_at: string }
  | { type: "file"; name: string; path: string; size: number; uploaded_at: string }

/**
 * public.assignments row (migration 011) plus the joined teacher display
 * name. Not yet in types/database.ts, so this file is its single owner for
 * the parent-facing surface — same convention as
 * components/parent/student-schema.ts for migration 010's tables.
 */
export interface Assignment {
  id: string
  teacher_id: string
  student_id: string
  title: string
  instructions: string | null
  subject: string | null
  due_date: string | null
  status: "assigned" | "submitted" | "graded"
  submitted_at: string | null
  submission_attachments: SubmissionAttachment[] | null
  grade: string | null
  feedback: string | null
  created_at: string | null
  teachers: { display_name: string } | null
}

/** public.teacher_notes row (migration 011), non-private only — see RLS note in the page. */
export interface TeacherNote {
  id: string
  teacher_id: string
  student_id: string
  body: string
  created_at: string | null
  teachers: { display_name: string } | null
}

/** public.announcements row (migration 011) with the author's display name resolved separately. */
export interface AnnouncementItem {
  id: string
  title: string
  body: string
  published_at: string | null
  authorName: string
}

interface SectionState<T> {
  data: T[]
  loading: boolean
  error: string | null
}

export interface ProgressFeedProps {
  assignments: SectionState<Assignment>
  notes: SectionState<TeacherNote>
  announcements: SectionState<AnnouncementItem>
  progress: SectionState<StudentProgress>
  onSubmitAssignment: (assignment: Assignment) => void
  onRetryAssignments: () => void
  onRetryNotes: () => void
  onRetryAnnouncements: () => void
  onRetryProgress: () => void
}

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

function SectionHeader({ icon: Icon, title }: { icon: typeof BookOpen; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-accent-primary" />
      <h3 className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">{title}</h3>
    </div>
  )
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-surface-elevated/60" />
      ))}
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <JarvisCard glow="none" className="p-6 text-center">
      <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-accent-danger" />
      <p className="text-sm text-text-primary">{message}</p>
      <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
        Try Again
      </Button>
    </JarvisCard>
  )
}

function EmptyState({ icon: Icon, message }: { icon: typeof BookOpen; message: string }) {
  return (
    <JarvisCard glow="none" className="p-6 text-center">
      <Icon className="mx-auto mb-2 h-8 w-8 text-text-disabled" />
      <p className="text-sm text-text-muted">{message}</p>
    </JarvisCard>
  )
}

type FileAttachment = Extract<SubmissionAttachment, { type: "file" }>

/**
 * Resolves a signed URL (5 min TTL) for a file in the private
 * `homework-submissions` bucket and renders it as a link once ready. The
 * bucket is private, so a public URL would 404 — every view must go through
 * `createSignedUrl`.
 */
function FileAttachmentLink({ attachment }: { attachment: FileAttachment }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const load = async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        const { data, error: signError } = await supabase.storage
          .from("homework-submissions")
          .createSignedUrl(attachment.path, 300)
        if (cancelled) return
        if (signError || !data?.signedUrl) {
          setError("Link unavailable")
          setLoading(false)
          return
        }
        setUrl(data.signedUrl)
        setLoading(false)
      } catch {
        if (!cancelled) {
          setError("Link unavailable")
          setLoading(false)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [attachment.path])

  if (loading) {
    return <span className="text-xs text-text-muted">{attachment.name} — loading link…</span>
  }
  if (error || !url) {
    return (
      <span className="text-xs text-accent-danger">
        {attachment.name} — {error ?? "link unavailable"}
      </span>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-accent-primary underline underline-offset-2 hover:text-accent-primary/80"
    >
      <Paperclip className="h-3 w-3" />
      {attachment.name}
    </a>
  )
}

function SubmissionAttachments({ attachments }: { attachments: SubmissionAttachment[] }) {
  if (attachments.length === 0) return null
  return (
    <div className="mt-3 space-y-1.5 rounded-lg border border-border bg-surface-elevated/40 p-3">
      <p className="font-mono text-xs uppercase tracking-wide text-text-muted">Submission</p>
      <div className="flex flex-col gap-1.5">
        {attachments.map((attachment, i) =>
          attachment.type === "file" ? (
            <FileAttachmentLink key={attachment.path} attachment={attachment} />
          ) : (
            <p key={`note-${i}`} className="text-xs text-text-muted">
              Note: {attachment.text}
            </p>
          )
        )}
      </div>
    </div>
  )
}

/** The parent's full progress feed on /parent/progress: homework, teacher notes, announcements, progress reports. */
export function ProgressFeed({
  assignments,
  notes,
  announcements,
  progress,
  onSubmitAssignment,
  onRetryAssignments,
  onRetryNotes,
  onRetryAnnouncements,
  onRetryProgress,
}: ProgressFeedProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <div className="space-y-8">
      {/* ── Homework / assignments ────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeader icon={BookOpen} title="Homework" />
        {assignments.loading ? (
          <SkeletonRows count={2} />
        ) : assignments.error ? (
          <ErrorState message={assignments.error} onRetry={onRetryAssignments} />
        ) : assignments.data.length === 0 ? (
          <EmptyState icon={BookOpen} message="No homework yet. Assignments from teachers will show up here." />
        ) : (
          <div className="space-y-3">
            {assignments.data.map((assignment, i) => (
              <motion.div
                key={assignment.id}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: i * 0.05 }}
              >
                <JarvisCard glow="none" className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-display text-base font-bold text-text-primary">{assignment.title}</p>
                      <p className="mt-0.5 truncate text-xs text-text-muted">
                        {assignment.teachers?.display_name ?? "Teacher"}
                        {assignment.subject ? ` · ${assignment.subject}` : ""}
                        {assignment.due_date ? ` · Due ${formatDate(assignment.due_date)}` : ""}
                      </p>
                    </div>
                    <StatusPill
                      label={ASSIGNMENT_STATUS_LABEL[assignment.status]}
                      tone={ASSIGNMENT_STATUS_TONE[assignment.status]}
                    />
                  </div>

                  {assignment.instructions && (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-text-muted">{assignment.instructions}</p>
                  )}

                  {assignment.submission_attachments && assignment.submission_attachments.length > 0 && (
                    <SubmissionAttachments attachments={assignment.submission_attachments} />
                  )}

                  {assignment.status === "graded" && (
                    <div className="mt-3 space-y-1 rounded-lg border border-accent-success/20 bg-accent-success/5 p-3">
                      <p className="font-mono text-xs uppercase tracking-wide text-accent-success">
                        Grade: {assignment.grade ?? "—"}
                      </p>
                      {assignment.feedback && <p className="text-sm text-text-primary">{assignment.feedback}</p>}
                    </div>
                  )}

                  {/* Edit-lock: the parent may only submit while status === "assigned". The
                      guard trigger (migration 011) restricts which columns a parent write may
                      touch, but does not itself stop a second submit while status stays
                      "submitted" — so the lock is enforced here in the UI by only ever showing
                      the Submit control in the "assigned" state. */}
                  {assignment.status === "assigned" && (
                    <div className="mt-4 flex justify-end">
                      <Button type="button" variant="aurora" size="sm" onClick={() => onSubmitAssignment(assignment)}>
                        Submit
                      </Button>
                    </div>
                  )}

                  {assignment.status === "submitted" && (
                    <div className="mt-3 space-y-1">
                      {assignment.submitted_at && (
                        <p className="text-xs text-text-muted">Submitted {formatDateTime(assignment.submitted_at)}</p>
                      )}
                      <p className="text-xs text-text-muted">
                        Submitted — waiting for your teacher. Ask them to reopen it if you need to change it.
                      </p>
                    </div>
                  )}
                </JarvisCard>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* ── Teacher notes ─────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeader icon={MessageSquare} title="Notes From Your Teacher" />
        {notes.loading ? (
          <SkeletonRows count={1} />
        ) : notes.error ? (
          <ErrorState message={notes.error} onRetry={onRetryNotes} />
        ) : notes.data.length === 0 ? (
          <EmptyState icon={MessageSquare} message="No notes shared yet." />
        ) : (
          <div className="space-y-3">
            {notes.data.map((note, i) => (
              <motion.div
                key={note.id}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: i * 0.05 }}
              >
                <JarvisCard glow="none" className="p-5">
                  <p className="text-sm text-text-primary">{note.body}</p>
                  <p className="mt-2 text-xs text-text-muted">
                    {note.teachers?.display_name ?? "Teacher"}
                    {note.created_at ? ` · ${formatDate(note.created_at)}` : ""}
                  </p>
                </JarvisCard>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* ── Announcements ─────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeader icon={Megaphone} title="Announcements" />
        {announcements.loading ? (
          <SkeletonRows count={1} />
        ) : announcements.error ? (
          <ErrorState message={announcements.error} onRetry={onRetryAnnouncements} />
        ) : announcements.data.length === 0 ? (
          <EmptyState icon={Megaphone} message="No announcements right now." />
        ) : (
          <div className="space-y-3">
            {announcements.data.map((announcement, i) => (
              <motion.div
                key={announcement.id}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: i * 0.05 }}
              >
                <JarvisCard glow="none" className="p-5">
                  <p className="font-display text-base font-bold text-text-primary">{announcement.title}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-text-muted">{announcement.body}</p>
                  <p className="mt-2 text-xs text-text-muted">
                    {announcement.authorName}
                    {announcement.published_at ? ` · ${formatDate(announcement.published_at)}` : ""}
                  </p>
                </JarvisCard>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* ── Progress reports ──────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeader icon={TrendingUp} title="Progress Reports" />
        {progress.loading ? (
          <SkeletonRows count={1} />
        ) : progress.error ? (
          <ErrorState message={progress.error} onRetry={onRetryProgress} />
        ) : progress.data.length === 0 ? (
          <EmptyState icon={TrendingUp} message="No progress reports yet. Monthly attendance and grades will appear here." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {progress.data.map((p, i) => (
              <motion.div
                key={p.id}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: i * 0.05 }}
              >
                <JarvisCard glow="none" className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-display text-sm font-bold text-text-primary">
                      {p.subject} · {formatDate(p.month)}
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-wide text-text-muted">Attendance</p>
                      <p className="font-mono text-lg font-bold tabular-nums text-accent-primary">
                        {p.attendance_pct ?? 0}%
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-xs uppercase tracking-wide text-text-muted">Grade</p>
                      <p className="font-mono text-lg font-bold tabular-nums text-accent-success">
                        {p.grade_label ?? p.grade ?? "—"}
                      </p>
                    </div>
                  </div>
                  {(p.sessions_held != null || p.sessions_total != null) && (
                    <p className="mt-3 text-xs tabular-nums text-text-muted">
                      Sessions held: {p.sessions_held ?? 0} / {p.sessions_total ?? 0}
                    </p>
                  )}
                  {p.teacher_comment && <p className="mt-2 text-sm text-text-muted">{p.teacher_comment}</p>}
                </JarvisCard>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
