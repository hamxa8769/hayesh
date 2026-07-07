"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Users, TrendingUp, BookOpen } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { useSupabase } from "@/hooks/useSupabase"
import type { StudentProgress } from "@/types/database"

export default function ProgressPage() {
  const { user } = useSupabase()
  const [progress, setProgress] = useState<StudentProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetchProgress = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data } = await supabase
        .from("student_progress")
        .select("*")
        .eq("parent_id", user.id)
        .order("month", { ascending: false })

      setProgress((data || []) as StudentProgress[])
      setLoading(false)
    }
    fetchProgress()
  }, [user])

  const children = Array.from(new Set(progress.map(p => p.child_name)))

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-display font-bold text-text-primary">Student Progress</h2>
      </motion.div>

      {loading ? (
        <p className="text-text-muted">Loading progress...</p>
      ) : children.length === 0 ? (
        <JarvisCard glow="none" className="p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-text-disabled mb-3" />
          <p className="text-text-muted">No progress data yet</p>
        </JarvisCard>
      ) : (
        children.map((child) => {
          const childProgress = progress.filter(p => p.child_name === child)
          const latest = childProgress[0]
          return (
            <motion.div key={child} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <JarvisCard glow="violet" className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <BookOpen className="h-5 w-5 text-accent-primary" />
                  <h3 className="font-display text-lg font-semibold text-text-primary">{child}</h3>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-sm text-text-muted">Attendance</p>
                    <p className="font-mono text-xl font-bold text-accent-success">{latest?.attendance_pct?.toFixed(0) || 0}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-text-muted">Sessions Held</p>
                    <p className="font-mono text-xl font-bold text-text-primary">{latest?.sessions_held || 0}/{latest?.sessions_total || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-text-muted">Grade</p>
                    <p className="font-mono text-xl font-bold text-accent-primary">{latest?.grade_label || latest?.grade?.toFixed(0) || "—"}</p>
                  </div>
                </div>
                {latest?.teacher_comment && (
                  <p className="mt-3 text-sm text-text-muted italic">&ldquo;{latest.teacher_comment}&rdquo;</p>
                )}
              </JarvisCard>
            </motion.div>
          )
        })
      )}
    </div>
  )
}
