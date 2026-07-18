"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { AlertTriangle, Plus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { useSupabase } from "@/hooks/useSupabase"
import { StudentCard } from "@/components/parent/StudentCard"
import { StudentFormModal } from "@/components/parent/StudentFormModal"
import type { Student, StudentValues } from "@/components/parent/student-schema"

export default function ParentStudentsPage() {
  const { user } = useSupabase()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)

  const loadStudents = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data, error: fetchError } = await supabase
        .from("students")
        .select("*")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: false })

      if (fetchError) {
        setError(fetchError.message)
        return
      }
      setStudents((data || []) as Student[])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load your children. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadStudents()
  }, [loadStudents])

  const openAddModal = () => {
    setEditingStudent(null)
    setModalOpen(true)
  }

  const openEditModal = (student: Student) => {
    setEditingStudent(student)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingStudent(null)
  }

  const handleSubmit = async (values: StudentValues): Promise<{ error: string | null }> => {
    if (!user) return { error: "You must be signed in." }
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()

    const payload = {
      full_name: values.full_name,
      date_of_birth: values.date_of_birth || null,
      grade_level: values.grade_level || null,
      notes: values.notes || null,
    }

    if (editingStudent) {
      const { error: updateError } = await supabase
        .from("students")
        .update(payload)
        .eq("id", editingStudent.id)
        .eq("parent_id", user.id)
      if (updateError) return { error: updateError.message }
    } else {
      const { error: insertError } = await supabase.from("students").insert({
        ...payload,
        parent_id: user.id,
        created_by: user.id,
      })
      if (insertError) return { error: insertError.message }
    }

    await loadStudents()
    return { error: null }
  }

  const handleToggleActive = async (student: Student) => {
    if (!user) return
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from("students")
      .update({ is_active: !(student.is_active ?? true) })
      .eq("id", student.id)
      .eq("parent_id", user.id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    await loadStudents()
  }

  const handleDelete = async (student: Student) => {
    if (!user) return
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const { error: deleteError } = await supabase.from("students").delete().eq("id", student.id).eq("parent_id", user.id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    await loadStudents()
  }

  // Memoized on editingStudent so the modal's reset effect (keyed on this
  // object's identity) only fires when the edit target actually changes —
  // not on every unrelated re-render of this page while the modal is open.
  const editingValues: StudentValues | undefined = useMemo(
    () =>
      editingStudent
        ? {
            full_name: editingStudent.full_name,
            date_of_birth: editingStudent.date_of_birth || "",
            grade_level: editingStudent.grade_level || "",
            notes: editingStudent.notes || "",
          }
        : undefined,
    [editingStudent]
  )

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div>
          <h2 className="font-display text-2xl font-bold text-text-primary">My Children</h2>
          <p className="mt-1 text-sm text-text-muted">Manage your children&apos;s profiles before requesting a teacher.</p>
        </div>
        <Button type="button" variant="aurora" onClick={openAddModal}>
          <Plus className="h-4 w-4" />
          Add Child
        </Button>
      </motion.div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-lg border border-border bg-surface-elevated/60" />
          ))}
        </div>
      ) : error ? (
        <JarvisCard glow="none" className="p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-accent-danger" />
          <p className="text-text-primary">Couldn&apos;t load your children</p>
          <p className="mt-1 text-sm text-text-muted">{error}</p>
          <Button type="button" variant="secondary" className="mt-4" onClick={loadStudents}>
            Try Again
          </Button>
        </JarvisCard>
      ) : students.length === 0 ? (
        <JarvisCard glow="none" className="p-8 text-center">
          <Users className="mx-auto mb-3 h-12 w-12 text-text-disabled" />
          <p className="text-text-primary">No children added yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-text-muted">
            Add your first child&apos;s profile so you can request a demo lesson or tutoring subject for them.
          </p>
          <Button type="button" variant="aurora" className="mt-4" onClick={openAddModal}>
            <Plus className="h-4 w-4" />
            Add Your First Child
          </Button>
        </JarvisCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((student, i) => (
            <StudentCard
              key={student.id}
              student={student}
              index={i}
              onEdit={() => openEditModal(student)}
              onToggleActive={() => handleToggleActive(student)}
              onDelete={() => handleDelete(student)}
            />
          ))}
        </div>
      )}

      <StudentFormModal open={modalOpen} onClose={closeModal} initialValues={editingValues} onSubmit={handleSubmit} />
    </div>
  )
}
