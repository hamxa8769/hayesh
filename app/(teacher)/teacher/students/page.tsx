"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Users, BookOpen } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { useSupabase } from "@/hooks/useSupabase"

interface StudentInfo {
  child_name: string
  subject: string
  tier: string
  sessions_held: number
  attendance_pct: number
}

export default function StudentsPage() {
  const { user } = useSupabase()
  const [students, setStudents] = useState<StudentInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetchStudents = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .single()

      if (!teacher) { setLoading(false); return }

      const { data: subs } = await supabase
        .from("subscriptions")
        .select("child_name, subject, tier")
        .eq("teacher_id", teacher.id)
        .eq("status", "active")

      const { data: progress } = await supabase
        .from("student_progress")
        .select("child_name, attendance_pct, sessions_held")

      const studentMap = new Map<string, StudentInfo>()
      subs?.forEach((s) => {
        const key = `${s.child_name}-${s.subject}`
        const prog = progress?.find(p => p.child_name === s.child_name)
        studentMap.set(key, {
          child_name: s.child_name,
          subject: s.subject,
          tier: s.tier,
          sessions_held: prog?.sessions_held || 0,
          attendance_pct: prog?.attendance_pct || 0,
        })
      })

      setStudents(Array.from(studentMap.values()))
      setLoading(false)
    }
    fetchStudents()
  }, [user])

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-display font-bold text-text-primary">My Students</h2>
      </motion.div>

      {loading ? (
        <p className="text-text-muted">Loading students...</p>
      ) : students.length === 0 ? (
        <JarvisCard glow="none" className="p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-text-disabled mb-3" />
          <p className="text-text-muted">No students yet</p>
        </JarvisCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((student, i) => (
            <motion.div
              key={`${student.child_name}-${student.subject}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <JarvisCard glow="violet" className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-primary/10">
                    <BookOpen className="h-5 w-5 text-accent-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">{student.child_name}</p>
                    <p className="text-xs text-text-muted">{student.subject} • {student.tier}</p>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <div>
                    <p className="text-text-muted">Sessions</p>
                    <p className="font-mono font-bold text-text-primary">{student.sessions_held}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Attendance</p>
                    <p className="font-mono font-bold text-accent-success">{student.attendance_pct.toFixed(0)}%</p>
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
