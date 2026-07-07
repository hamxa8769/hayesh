"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Users } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { useSupabase } from "@/hooks/useSupabase"

interface Progress { child_name: string; subject: string; attendance_pct: number; grade: string }

export default function ProgressPage() {
  const { user } = useSupabase()
  const [data, setData] = useState<Progress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data: d } = await supabase.from("student_progress").select("*").eq("parent_id", user.id)
      setData((d || []) as Progress[])
      setLoading(false)
    }
    load()
  }, [user])

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-2xl font-bold">Student Progress</h2>
      </motion.div>

      {loading ? <p className="text-text-muted">Loading...</p> : data.length === 0 ? (
        <JarvisCard glow="none" className="p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-text-disabled mb-3" />
          <p className="text-text-muted">No progress data yet</p>
        </JarvisCard>
      ) : (
        <div className="space-y-3">
          {data.map((p, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <JarvisCard glow="none" className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-text-primary">{p.child_name}</p>
                    <p className="text-xs text-text-muted">{p.subject}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-text-muted">Attendance</p>
                      <p className="font-mono text-sm font-bold text-accent-primary">{p.attendance_pct || 0}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-text-muted">Grade</p>
                      <p className="font-mono text-sm font-bold text-accent-success">{p.grade || "N/A"}</p>
                    </div>
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
