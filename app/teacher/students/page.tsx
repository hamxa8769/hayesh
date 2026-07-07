"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Users, BookOpen } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { useSupabase } from "@/hooks/useSupabase"

interface Student { child_name: string; parent_id: string; status: string }

export default function StudentsPage() {
  const { user } = useSupabase()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data } = await supabase.from("subscriptions").select("child_name, parent_id, status")
        .eq("teacher_id", user.id).eq("status", "active")
      setStudents((data || []) as Student[])
      setLoading(false)
    }
    load()
  }, [user])

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-2xl font-bold">Students</h2>
        <p className="text-text-muted">{students.length} active students</p>
      </motion.div>

      {loading ? (
        <p className="text-text-muted">Loading...</p>
      ) : students.length === 0 ? (
        <JarvisCard glow="none" className="p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-text-disabled mb-3" />
          <p className="text-text-muted">No students yet</p>
        </JarvisCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <JarvisCard glow="none" className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-primary/20">
                    <BookOpen className="h-5 w-5 text-accent-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">{s.child_name}</p>
                    <p className="text-xs text-text-muted">Active subscription</p>
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
