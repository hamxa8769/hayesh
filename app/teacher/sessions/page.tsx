"use client"

import { useEffect, useState } from "react"
import { Calendar, Clock, Video } from "lucide-react"
import { Pill } from "@/components/ui/pill"
import { Reveal } from "@/components/motion/Reveal"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { cn } from "@/lib/utils/cn"
import { useSupabase } from "@/hooks/useSupabase"
import { formatDateTime } from "@/lib/utils/format"
import type { Session, SessionStatus } from "@/types/database"

const FILTERS = ["all", "scheduled", "in_progress", "completed"] as const

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  scheduled: { label: "Scheduled", className: "border-[#56B6FF]/30 bg-[#56B6FF]/10 text-[#56B6FF]" },
  in_progress: { label: "In Progress", className: "border-[#56B6FF]/40 bg-[#56B6FF]/15 text-[#56B6FF]" },
  completed: { label: "Completed", className: "border-transparent bg-accent-success/20 text-accent-success" },
  cancelled: { label: "Cancelled", className: "border-transparent bg-accent-danger/20 text-accent-danger" },
  no_show: { label: "No Show", className: "border-transparent bg-accent-warning/20 text-accent-warning" },
}

function StatusPill({ status }: { status: SessionStatus | null }) {
  const style = STATUS_STYLES[status ?? "scheduled"] ?? STATUS_STYLES.scheduled
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide",
        style.className
      )}
    >
      {style.label}
    </span>
  )
}

export default function SessionsPage() {
  const { user } = useSupabase()
  const [sessions, setSessions] = useState<Session[]>([])
  const [filter, setFilter] = useState<string>("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      let query = supabase.from("sessions").select("*").eq("teacher_id", user.id).order("scheduled_at", { ascending: false })
      if (filter !== "all") query = query.eq("status", filter)
      const { data } = await query
      setSessions((data || []) as Session[])
      setLoading(false)
    }
    load()
  }, [user, filter])

  return (
    <div className="space-y-6">
      <Reveal>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text-primary">Sessions</h2>
      </Reveal>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((s) => (
          <Pill key={s} active={filter === s} onClick={() => setFilter(s)} className="capitalize">
            {s.replace("_", " ")}
          </Pill>
        ))}
      </div>

      {loading ? (
        <p className="text-text-muted">Loading...</p>
      ) : sessions.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <Calendar className="mx-auto mb-3 h-12 w-12 text-text-disabled" />
          <p className="text-text-muted">No sessions found</p>
        </div>
      ) : (
        <PanelGroup className="space-y-3">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-line-strong"
            >
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 shrink-0 text-accent-primary" />
                <div>
                  <p className="font-medium text-text-primary">{s.subject || "Session"}</p>
                  <p className="flex items-center gap-1 font-mono text-xs tabular-nums text-text-muted">
                    <Clock className="h-3 w-3" /> {s.scheduled_at ? formatDateTime(s.scheduled_at) : "TBD"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={s.status} />
                {s.status === "scheduled" && (
                  <a href={s.livekit_room || "#"} target="_blank" rel="noopener noreferrer">
                    <span className="flex items-center gap-1.5 rounded-lg border border-accent-primary/30 bg-accent-primary/10 px-3 py-1.5 text-xs font-medium text-accent-primary transition-colors hover:bg-accent-primary/20">
                      <Video className="h-3.5 w-3.5" /> Join
                    </span>
                  </a>
                )}
              </div>
            </div>
          ))}
        </PanelGroup>
      )}
    </div>
  )
}
