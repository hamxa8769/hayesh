"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Calendar, Clock, Video } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { Badge } from "@/components/ui/badge"
import { useSupabase } from "@/hooks/useSupabase"
import { formatDateTime } from "@/lib/utils/format"
import type { Session, SessionStatus } from "@/types/database"

const statusColors: Record<SessionStatus, "default" | "success" | "destructive" | "warning"> = {
  scheduled: "default",
  completed: "success",
  cancelled: "destructive",
  no_show: "warning",
}

export default function SessionsPage() {
  const { user } = useSupabase()
  const [sessions, setSessions] = useState<Session[]>([])
  const [filter, setFilter] = useState<SessionStatus | "all">("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetchSessions = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .single()

      if (!teacher) { setLoading(false); return }

      const { data } = await supabase
        .from("sessions")
        .select("*")
        .eq("teacher_id", teacher.id)
        .order("scheduled_at", { ascending: false })
        .limit(50)

      setSessions((data || []) as Session[])
      setLoading(false)
    }
    fetchSessions()
  }, [user])

  const filtered = filter === "all" ? sessions : sessions.filter(s => s.status === filter)

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-display font-bold text-text-primary">Sessions</h2>
      </motion.div>

      <div className="flex gap-2 flex-wrap">
        {(["all", "scheduled", "completed", "cancelled"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${filter === s ? "bg-accent-primary/20 text-accent-primary" : "text-text-muted hover:bg-surface-elevated"}`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-text-muted">Loading sessions...</p>
      ) : filtered.length === 0 ? (
        <JarvisCard glow="none" className="p-8 text-center">
          <Calendar className="mx-auto h-12 w-12 text-text-disabled mb-3" />
          <p className="text-text-muted">No sessions found</p>
        </JarvisCard>
      ) : (
        <div className="space-y-3">
          {filtered.map((session, i) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <JarvisCard glow="none" className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-elevated">
                      <Calendar className="h-5 w-5 text-accent-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-text-primary">{session.child_name} — {session.subject}</p>
                      <p className="text-sm text-text-muted flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDateTime(session.scheduled_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusColors[session.status || "scheduled"]}>
                      {session.status}
                    </Badge>
                    {session.status === "scheduled" && (
                      <JarvisButton variant="primary" size="sm">
                        <Video className="h-4 w-4" />
                        Join
                      </JarvisButton>
                    )}
                  </div>
                </div>
              </JarvisCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
