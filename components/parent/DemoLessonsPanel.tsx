"use client"

import { useEffect, useState } from "react"
import { CalendarClock } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { StatusPill } from "@/components/teacher/DemoRequestCard"
import { formatDateTime } from "@/lib/utils/format"
import { createClient } from "@/lib/supabase/client"
import type { DemoBooking } from "@/types/database"

type DemoRow = Pick<DemoBooking, "id" | "child_name" | "subject" | "scheduled_at" | "status"> & {
  teachers: { display_name: string | null } | null
}

/** The parent's free demo lessons with their live status (pending → confirmed / declined). */
export function DemoLessonsPanel({ parentId }: { parentId: string }) {
  const [rows, setRows] = useState<DemoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      const { data, error: fetchError } = await createClient()
        .from("demo_bookings")
        .select("id, child_name, subject, scheduled_at, status, teachers(display_name)")
        .eq("parent_id", parentId)
        .order("scheduled_at", { ascending: true })
      if (!active) return
      if (fetchError) setError(fetchError.message)
      else setRows((data ?? []) as unknown as DemoRow[])
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [parentId])

  if (loading) return <div className="h-20 animate-pulse rounded-lg border border-border bg-surface-elevated/60" />
  if (error) return <p className="text-sm text-accent-danger">Couldn&apos;t load your demo lessons: {error}</p>
  if (rows.length === 0) return null

  return (
    <section aria-label="Demo lessons" className="space-y-3">
      <h3 className="font-display text-lg font-semibold text-text-primary">Demo lessons</h3>
      {rows.map((r) => (
        <JarvisCard key={r.id} glow="none" className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <CalendarClock className="h-5 w-5 text-accent-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-text-primary">
                {r.child_name} · {r.subject}
              </p>
              <p className="text-xs text-text-muted">
                {r.teachers?.display_name ?? "Teacher"} · {formatDateTime(r.scheduled_at)}
              </p>
            </div>
          </div>
          <StatusPill status={r.status} />
        </JarvisCard>
      ))}
    </section>
  )
}
