"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { GraduationCap, Users, Calendar, Wallet, TrendingUp, Clock } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { Badge } from "@/components/ui/badge"
import { useSupabase } from "@/hooks/useSupabase"
import { formatPKR, formatDate } from "@/lib/utils/format"
import type { Teacher } from "@/types/database"

export default function TeacherDashboardPage() {
  const { user } = useSupabase()
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [stats, setStats] = useState({ students: 0, sessions: 0, pending: 0 })

  useEffect(() => {
    if (!user) return
    const fetchTeacher = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      const { data } = await supabase
        .from("teachers")
        .select("*")
        .eq("user_id", user.id)
        .single()

      if (data) {
        setTeacher(data as Teacher)
        setStats({
          students: data.total_students || 0,
          sessions: data.total_sessions || 0,
          pending: 0,
        })
      }
    }
    fetchTeacher()
  }, [user])

  const statCards = [
    { label: "Total Students", value: stats.students, icon: Users, color: "text-accent-primary" },
    { label: "Total Sessions", value: stats.sessions, icon: Calendar, color: "text-accent-secondary" },
    { label: "Avg Rating", value: teacher?.average_rating?.toFixed(1) || "—", icon: TrendingUp, color: "text-accent-success" },
    { label: "Status", value: teacher?.status || "pending", icon: Clock, color: teacher?.status === "approved" ? "text-accent-success" : "text-accent-warning" },
  ]

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-display font-bold text-text-primary">Welcome back!</h2>
        <p className="text-text-muted">Here&apos;s your teaching overview.</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <JarvisCard glow="violet" className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-muted">{stat.label}</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-text-primary">{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color} opacity-50`} />
              </div>
            </JarvisCard>
          </motion.div>
        ))}
      </div>

      {teacher && teacher.status === "pending" && (
        <JarvisCard glow="none" className="p-6 border-accent-warning/30">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-accent-warning" />
            <div>
              <p className="font-medium text-text-primary">Profile Under Review</p>
              <p className="text-sm text-text-muted">Your teacher profile is pending admin approval. You&apos;ll be notified once approved.</p>
            </div>
          </div>
        </JarvisCard>
      )}

      <JarvisCard glow="none" className="p-6">
        <h3 className="font-display text-lg font-semibold text-text-primary mb-4">Quick Actions</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <a href="/teacher/profile" className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-surface-elevated transition-colors">
            <GraduationCap className="h-5 w-5 text-accent-primary" />
            <span className="text-sm text-text-primary">Edit Profile</span>
          </a>
          <a href="/teacher/sessions" className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-surface-elevated transition-colors">
            <Calendar className="h-5 w-5 text-accent-secondary" />
            <span className="text-sm text-text-primary">View Sessions</span>
          </a>
          <a href="/teacher/earnings" className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-surface-elevated transition-colors">
            <Wallet className="h-5 w-5 text-accent-success" />
            <span className="text-sm text-text-primary">Check Earnings</span>
          </a>
        </div>
      </JarvisCard>
    </div>
  )
}
