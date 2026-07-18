"use client"

import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { AlertTriangle, BookOpen, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { useSupabase } from "@/hooks/useSupabase"
import { RequestCard } from "@/components/parent/RequestCard"
import { RequestFormModal } from "@/components/parent/RequestFormModal"
import type { Student, StudentRequestWithRelations, RequestValues } from "@/components/parent/student-schema"

export default function ParentRequestsPage() {
  const { user } = useSupabase()
  const [requests, setRequests] = useState<StudentRequestWithRelations[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      const [requestsRes, studentsRes] = await Promise.all([
        supabase
          .from("student_requests")
          .select("*, students(full_name), teachers(display_name)")
          .eq("parent_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("students").select("*").eq("parent_id", user.id).order("full_name", { ascending: true }),
      ])

      if (requestsRes.error) {
        setError(requestsRes.error.message)
        return
      }
      if (studentsRes.error) {
        setError(studentsRes.error.message)
        return
      }

      setRequests((requestsRes.data || []) as StudentRequestWithRelations[])
      setStudents((studentsRes.data || []) as Student[])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load your tutoring requests. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSubmit = async (values: RequestValues): Promise<{ error: string | null }> => {
    if (!user) return { error: "You must be signed in." }
    // Posted to a server route rather than inserted directly from the browser:
    // creating the row is only half the job, and admins have to be notified.
    // Writing a notification row for another user (an admin) is correctly
    // forbidden by RLS from the client, so that fan-out can only happen
    // server-side. Inserting here directly would leave requests invisible to
    // admins, which is exactly the bug this replaces.
    try {
      const res = await fetch("/api/student-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: values.student_id,
          subject: values.subject,
          preferred_tier: values.preferred_tier,
          notes: values.notes || undefined,
        }),
      })

      if (!res.ok) {
        const payload: unknown = await res.json().catch(() => null)
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "Could not submit your request."
        return { error: message }
      }
    } catch {
      return { error: "Could not reach the server. Check your connection and try again." }
    }

    await loadData()
    return { error: null }
  }

  const handleCancel = async (request: StudentRequestWithRelations) => {
    if (!user) return
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    // Cancelling is a DELETE, not a status update — the parent's RLS grant
    // on student_requests only permits UPDATE of (subject, preferred_tier,
    // notes), so status can never be flipped to 'cancelled' via update.
    const { error: deleteError } = await supabase
      .from("student_requests")
      .delete()
      .eq("id", request.id)
      .eq("parent_id", user.id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    await loadData()
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div>
          <h2 className="font-display text-2xl font-bold text-text-primary">Tutoring Requests</h2>
          <p className="mt-1 text-sm text-text-muted">Ask for a teacher in a subject and track admin assignment.</p>
        </div>
        <Button type="button" variant="aurora" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Request a Teacher
        </Button>
      </motion.div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg border border-border bg-surface-elevated/60" />
          ))}
        </div>
      ) : error ? (
        <JarvisCard glow="none" className="p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-accent-danger" />
          <p className="text-text-primary">Couldn&apos;t load your tutoring requests</p>
          <p className="mt-1 text-sm text-text-muted">{error}</p>
          <Button type="button" variant="secondary" className="mt-4" onClick={loadData}>
            Try Again
          </Button>
        </JarvisCard>
      ) : requests.length === 0 ? (
        <JarvisCard glow="none" className="p-8 text-center">
          <BookOpen className="mx-auto mb-3 h-12 w-12 text-text-disabled" />
          <p className="text-text-primary">No tutoring requests yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-text-muted">
            Request a teacher for one of your children and admin will assign one shortly.
          </p>
          <Button type="button" variant="aurora" className="mt-4" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Request a Teacher
          </Button>
        </JarvisCard>
      ) : (
        <div className="space-y-3">
          {requests.map((request, i) => (
            <RequestCard key={request.id} request={request} index={i} onCancel={() => handleCancel(request)} />
          ))}
        </div>
      )}

      <RequestFormModal open={modalOpen} onClose={() => setModalOpen(false)} students={students} onSubmit={handleSubmit} />
    </div>
  )
}
