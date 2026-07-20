"use client"

import { useCallback, useEffect, useState } from "react"
import { BookOpen, Plus, StickyNote } from "lucide-react"
import { Reveal } from "@/components/motion/Reveal"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { Pill } from "@/components/ui/pill"
import { Button } from "@/components/ui/button"
import { AssignmentFormModal } from "@/components/teacher/AssignmentFormModal"
import { AssignmentCard } from "@/components/teacher/AssignmentCard"
import { NoteFormModal } from "@/components/teacher/NoteFormModal"
import { createClient } from "@/lib/supabase/client"
import { useSupabase } from "@/hooks/useSupabase"
import type { AssignedStudent, AssignmentRow, AssignmentStatus, GradeAssignmentValues } from "@/components/teacher/teaching-schema"

const FILTERS = ["all", "assigned", "submitted", "graded"] as const
type Filter = (typeof FILTERS)[number]

interface StudentLite {
  id: string
  full_name: string
  grade_level: string | null
  parent_id: string
}

/**
 * PostgREST returns a single object for a many-to-one embed like
 * student_requests -> students, but supabase-js's generic inference widens it
 * to an array. Accept both rather than asserting one shape: the assertion is
 * what TypeScript rejected, and guessing wrong here would mean silently
 * rendering an empty student roster.
 */
interface StudentRequestJoinRow {
  student_id: string
  students: StudentLite | StudentLite[] | null
}

function firstStudent(value: StudentRequestJoinRow["students"]): StudentLite | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export default function AssignmentsPage() {
  const { user } = useSupabase()
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [students, setStudents] = useState<AssignedStudent[]>([])
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [filter, setFilter] = useState<Filter>("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
  const [modalStudentId, setModalStudentId] = useState<string | undefined>(undefined)
  const [noteStudent, setNoteStudent] = useState<AssignedStudent | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()

      const { data: teacherRow, error: teacherError } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()
      if (teacherError) throw teacherError
      const resolvedTeacherId = (teacherRow as { id: string } | null)?.id ?? null
      setTeacherId(resolvedTeacherId)
      if (!resolvedTeacherId) {
        setStudents([])
        setAssignments([])
        return
      }

      const [{ data: requestRows, error: requestsError }, { data: assignmentRows, error: assignmentsError }] =
        await Promise.all([
          supabase
            .from("student_requests")
            .select("student_id, students(id, full_name, grade_level, parent_id)")
            .eq("assigned_teacher_id", resolvedTeacherId)
            .eq("status", "assigned"),
          supabase
            .from("assignments")
            .select("*, students(full_name, grade_level)")
            .eq("teacher_id", resolvedTeacherId)
            .order("created_at", { ascending: false }),
        ])

      if (requestsError) throw requestsError
      if (assignmentsError) throw assignmentsError

      const seen = new Set<string>()
      const rosterStudents: AssignedStudent[] = []
      for (const row of (requestRows ?? []) as unknown as StudentRequestJoinRow[]) {
        const s = firstStudent(row.students)
        if (s && !seen.has(s.id)) {
          seen.add(s.id)
          rosterStudents.push({ id: s.id, full_name: s.full_name, grade_level: s.grade_level, parent_id: s.parent_id })
        }
      }

      setStudents(rosterStudents)
      setAssignments((assignmentRows ?? []) as AssignmentRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load assignments")
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const visibleAssignments =
    filter === "all" ? assignments : assignments.filter((a) => a.status === (filter as AssignmentStatus))

  const handleGraded = (id: string, values: GradeAssignmentValues) => {
    setAssignments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "graded", grade: values.grade, feedback: values.feedback ?? null } : a))
    )
  }

  const openAssignmentModal = (studentId?: string) => {
    setModalStudentId(studentId)
    setAssignmentModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text-primary">Assignments</h2>
            <p className="mt-1 font-mono text-sm tabular-nums text-text-muted">{assignments.length} total</p>
          </div>
          <Button variant="aurora" onClick={() => openAssignmentModal()} disabled={students.length === 0}>
            <Plus className="h-4 w-4" /> New Assignment
          </Button>
        </div>
      </Reveal>

      {loading ? (
        <p className="text-text-muted">Loading assignments...</p>
      ) : error ? (
        <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-4 text-sm text-accent-danger">
          {error}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Pill key={f} active={filter === f} onClick={() => setFilter(f)} className="capitalize">
                {f}
              </Pill>
            ))}
          </div>

          {visibleAssignments.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-8 text-center">
              <BookOpen className="mx-auto mb-3 h-12 w-12 text-text-disabled" />
              <p className="text-text-muted">
                {students.length === 0
                  ? "No students assigned to you yet. Homework tools unlock once a student is assigned."
                  : filter === "all"
                    ? "No assignments yet. Create your first one above."
                    : `No ${filter} assignments.`}
              </p>
            </div>
          ) : (
            <PanelGroup className="space-y-3">
              {visibleAssignments.map((a) => (
                <AssignmentCard key={a.id} assignment={a} onGraded={handleGraded} />
              ))}
            </PanelGroup>
          )}

          {students.length > 0 && (
            <section className="space-y-3">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">My Students</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {students.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-line-strong"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-text-primary">{s.full_name}</p>
                      {s.grade_level && <p className="text-xs text-text-muted">{s.grade_level}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => openAssignmentModal(s.id)}>
                        <Plus className="h-3.5 w-3.5" /> Homework
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setNoteStudent(s)}>
                        <StickyNote className="h-3.5 w-3.5" /> Note
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <AssignmentFormModal
        open={assignmentModalOpen}
        onClose={() => setAssignmentModalOpen(false)}
        students={students}
        defaultStudentId={modalStudentId}
        onCreated={load}
      />

      <NoteFormModal
        open={noteStudent !== null}
        onClose={() => setNoteStudent(null)}
        teacherId={teacherId ?? ""}
        student={noteStudent}
        onCreated={() => {}}
      />
    </div>
  )
}
