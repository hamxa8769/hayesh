"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { AlertTriangle, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { useSupabase } from "@/hooks/useSupabase"
import {
  ProgressFeed,
  type Assignment,
  type AnnouncementItem,
  type SubmissionAttachment,
  type TeacherNote,
} from "@/components/parent/ProgressFeed"
import { AssignmentSubmitModal } from "@/components/parent/AssignmentSubmitModal"
import { cn } from "@/lib/utils/cn"
import type { Student } from "@/components/parent/student-schema"
import type { StudentProgress } from "@/types/database"

interface SectionState<T> {
  data: T[]
  loading: boolean
  error: string | null
}

const emptySection = <T,>(): SectionState<T> => ({ data: [], loading: true, error: null })

export default function ParentProgressPage() {
  const { user } = useSupabase()
  const [students, setStudents] = useState<Student[]>([])
  const [studentsLoading, setStudentsLoading] = useState(true)
  const [studentsError, setStudentsError] = useState<string | null>(null)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)

  const [assignments, setAssignments] = useState<SectionState<Assignment>>(emptySection())
  const [notes, setNotes] = useState<SectionState<TeacherNote>>(emptySection())
  const [announcements, setAnnouncements] = useState<SectionState<AnnouncementItem>>(emptySection())
  const [progress, setProgress] = useState<SectionState<StudentProgress>>(emptySection())

  const [submitTarget, setSubmitTarget] = useState<Assignment | null>(null)

  const loadStudents = useCallback(async () => {
    if (!user) return
    setStudentsLoading(true)
    setStudentsError(null)
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("parent_id", user.id)
        .order("full_name", { ascending: true })

      if (error) {
        setStudentsError(error.message)
        return
      }
      const rows = (data || []) as Student[]
      setStudents(rows)
      setSelectedStudentId((current) => current ?? rows[0]?.id ?? null)
    } catch (e) {
      setStudentsError(e instanceof Error ? e.message : "Failed to load your children. Please try again.")
    } finally {
      setStudentsLoading(false)
    }
  }, [user])

  const loadAssignments = useCallback(async (studentId: string) => {
    setAssignments((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data, error } = await supabase
        .from("assignments")
        .select("*, teachers(display_name)")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })

      if (error) {
        setAssignments({ data: [], loading: false, error: error.message })
        return
      }
      setAssignments({ data: (data || []) as unknown as Assignment[], loading: false, error: null })
    } catch (e) {
      setAssignments({
        data: [],
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load homework. Please try again.",
      })
    }
  }, [])

  const loadNotes = useCallback(
    async (studentId: string) => {
      if (!user) return
      setNotes((prev) => ({ ...prev, loading: true, error: null }))
      try {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        // is_private = false is enforced by RLS regardless, but filtering here
        // too keeps the query's intent explicit and avoids ever depending on
        // RLS alone to hide a private note in a UI bug.
        const { data, error } = await supabase
          .from("teacher_notes")
          .select("*, teachers(display_name)")
          .eq("student_id", studentId)
          .eq("parent_id", user.id)
          .eq("is_private", false)
          .order("created_at", { ascending: false })

        if (error) {
          setNotes({ data: [], loading: false, error: error.message })
          return
        }
        setNotes({ data: (data || []) as unknown as TeacherNote[], loading: false, error: null })
      } catch (e) {
        setNotes({
          data: [],
          loading: false,
          error: e instanceof Error ? e.message : "Failed to load notes. Please try again.",
        })
      }
    },
    [user]
  )

  const loadProgress = useCallback(
    async (studentFullName: string) => {
      if (!user) return
      setProgress((prev) => ({ ...prev, loading: true, error: null }))
      try {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        // student_progress has no student_id FK (migration 010's own comment
        // notes children were denormalized as child_name text before real
        // student records existed) — matched here by name instead.
        const { data, error } = await supabase
          .from("student_progress")
          .select("*")
          .eq("parent_id", user.id)
          .eq("child_name", studentFullName)
          .order("month", { ascending: false })

        if (error) {
          setProgress({ data: [], loading: false, error: error.message })
          return
        }
        setProgress({ data: (data || []) as StudentProgress[], loading: false, error: null })
      } catch (e) {
        setProgress({
          data: [],
          loading: false,
          error: e instanceof Error ? e.message : "Failed to load progress reports. Please try again.",
        })
      }
    },
    [user]
  )

  const loadAnnouncements = useCallback(async () => {
    setAnnouncements((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data, error } = await supabase
        .from("announcements")
        .select("id, author_id, title, body, published_at")
        .order("published_at", { ascending: false })
        .limit(20)

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
    loadStudents()
  }, [loadStudents])

  useEffect(() => {
    loadAnnouncements()
  }, [loadAnnouncements])

  useEffect(() => {
    if (!selectedStudentId) return
    loadAssignments(selectedStudentId)
    loadNotes(selectedStudentId)
  }, [selectedStudentId, loadAssignments, loadNotes])

  useEffect(() => {
    const selected = students.find((s) => s.id === selectedStudentId)
    if (!selected) return
    loadProgress(selected.full_name)
  }, [selectedStudentId, students, loadProgress])

  const handleSubmitAssignment = async (
    attachments: SubmissionAttachment[]
  ): Promise<{ error: string | null }> => {
    if (!submitTarget) return { error: "No assignment selected" }
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      // Sends ONLY status/submitted_at/submission_attachments — migration
      // 011's enforce_assignment_write_scope BEFORE UPDATE trigger rejects a
      // parent write that touches anything else (title, grade, feedback,
      // etc.), so no other column may appear in this payload. The
      // attachments themselves (uploaded files + optional note) are built by
      // AssignmentSubmitModal, which also performs the storage upload.
      const { error } = await supabase
        .from("assignments")
        .update({
          status: "submitted",
          submitted_at: new Date().toISOString(),
          submission_attachments: attachments,
        })
        .eq("id", submitTarget.id)

      if (error) return { error: error.message }
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Could not submit. Please try again." }
    }

    if (selectedStudentId) await loadAssignments(selectedStudentId)
    return { error: null }
  }

  if (studentsLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-elevated/60" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-surface-elevated/60" />
          ))}
        </div>
      </div>
    )
  }

  if (studentsError) {
    return (
      <JarvisCard glow="none" className="p-8 text-center">
        <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-accent-danger" />
        <p className="text-text-primary">Couldn&apos;t load your children</p>
        <p className="mt-1 text-sm text-text-muted">{studentsError}</p>
        <Button type="button" variant="secondary" className="mt-4" onClick={loadStudents}>
          Try Again
        </Button>
      </JarvisCard>
    )
  }

  if (students.length === 0) {
    return (
      <JarvisCard glow="none" className="p-8 text-center">
        <Users className="mx-auto mb-3 h-12 w-12 text-text-disabled" />
        <p className="text-text-primary">Add a child to see their progress</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-text-muted">
          Once you add a child and they start lessons, homework, notes, and progress reports will show up here.
        </p>
        <Button asChild variant="aurora" className="mt-4">
          <Link href="/parent/students">Add a Child</Link>
        </Button>
      </JarvisCard>
    )
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2 className="font-display text-2xl font-bold text-text-primary">Progress</h2>
        <p className="mt-1 text-sm text-text-muted">Homework, teacher notes, announcements, and progress reports.</p>
      </motion.div>

      {students.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Select a child">
          {students.map((student) => (
            <button
              key={student.id}
              type="button"
              role="tab"
              aria-selected={student.id === selectedStudentId}
              onClick={() => setSelectedStudentId(student.id)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors duration-300",
                student.id === selectedStudentId
                  ? "border-accent-primary/40 bg-accent-primary/10 text-accent-primary"
                  : "border-border bg-surface-elevated text-text-muted hover:text-text-primary"
              )}
            >
              {student.full_name}
            </button>
          ))}
        </div>
      )}

      <ProgressFeed
        assignments={assignments}
        notes={notes}
        announcements={announcements}
        progress={progress}
        onSubmitAssignment={setSubmitTarget}
        onRetryAssignments={() => selectedStudentId && loadAssignments(selectedStudentId)}
        onRetryNotes={() => selectedStudentId && loadNotes(selectedStudentId)}
        onRetryAnnouncements={loadAnnouncements}
        onRetryProgress={() => {
          const selected = students.find((s) => s.id === selectedStudentId)
          if (selected) loadProgress(selected.full_name)
        }}
      />

      <AssignmentSubmitModal
        open={submitTarget !== null}
        assignment={submitTarget}
        onClose={() => setSubmitTarget(null)}
        onSubmit={handleSubmitAssignment}
      />
    </div>
  )
}
