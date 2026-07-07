"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Calendar, Clock, Video } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { Badge } from "@/components/ui/badge"
import { useSupabase } from "@/hooks/useSupabase"
import { formatDateTime } from "@/lib/utils/format"
import type { Session } from "@/types/database"

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

  const statusColors: Record<string, "default" | "success" | "warning" | "destructive" | "cyan"> = {
    scheduled: "default", in_progress: "cyan", completed: "success", cancelled: "destructive", no_show: "warning",
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-2xl font-bold">Sessions</h2>
      </motion.div>

      <div className="flex gap-2">
        {["all", "scheduled", "in_progress", "completed"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filter === s ? "bg-accent-primary/20 text-accent-primary" : "text-text-muted hover:text-text-primary"}`}>
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-text-muted">Loading...</p>
      ) : sessions.length === 0 ? (
        <JarvisCard glow="none" className="p-8 text-center">
          <Calendar className="mx-auto h-12 w-12 text-text-disabled mb-3" />
          <p className="text-text-muted">No sessions found</p>
        </JarvisCard>
      ) : (
        <div className="space-y-3">
          {sessions.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <JarvisCard glow="none" className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-accent-primary" />
                    <div>
                      <p className="font-medium text-text-primary">{s.subject || "Session"}</p>
                      <p className="flex items-center gap-1 text-xs text-text-muted">
                        <Clock className="h-3 w-3" /> {s.scheduled_at ? formatDateTime(s.scheduled_at) : "TBD"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusColors[s.status || "scheduled"]}>{s.status}</Badge>
                    {s.status === "scheduled" && (
                      <a href={s.livekit_room || "#"} target="_blank" rel="noopener noreferrer">
                        <span className="flex items-center gap-1 rounded-lg bg-accent-primary/20 px-3 py-1.5 text-xs text-accent-primary hover:bg-accent-primary/30">
                          <Video className="h-3.5 w-3.5" /> Join
                        </span>
                      </a>
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
