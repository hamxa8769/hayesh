"use client"

import { useEffect, useState } from "react"
import { Users, BookOpen } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Reveal } from "@/components/motion/Reveal"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { useSupabase } from "@/hooks/useSupabase"

interface Student {
  child_name: string
  parent_id: string
  status: string
}

export default function StudentsPage() {
  const { user } = useSupabase()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data } = await supabase
        .from("subscriptions")
        .select("child_name, parent_id, status")
        .eq("teacher_id", user.id)
        .eq("status", "active")
      setStudents((data || []) as Student[])
      setLoading(false)
    }
    load()
  }, [user])

  return (
    <div className="space-y-6">
      <Reveal>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text-primary">Students</h2>
        <p className="mt-1 font-mono text-sm tabular-nums text-text-muted">{students.length} active students</p>
      </Reveal>

      {loading ? (
        <p className="text-text-muted">Loading...</p>
      ) : students.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <Users className="mx-auto mb-3 h-12 w-12 text-text-disabled" />
          <p className="text-text-muted">No students yet</p>
        </div>
      ) : (
        <PanelGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((s, i) => (
            <div
              key={`${s.parent_id}-${i}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-5 transition-colors hover:border-line-strong"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface-elevated">
                  <BookOpen className="h-5 w-5 text-accent-primary" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-text-primary">{s.child_name}</p>
                  <p className="text-xs text-text-muted">Active subscription</p>
                </div>
              </div>
              <Badge variant="success" className="shrink-0">Active</Badge>
            </div>
          ))}
        </PanelGroup>
      )}
    </div>
  )
}
