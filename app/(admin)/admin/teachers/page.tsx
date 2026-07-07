"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { GraduationCap, CheckCircle, XCircle } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import type { Teacher } from "@/types/database"

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTeachers = async () => {
    const supabase = createClient()
    const { data } = await supabase.from("teachers").select("*").order("created_at", { ascending: false })
    setTeachers((data || []) as Teacher[])
    setLoading(false)
  }

  useEffect(() => { fetchTeachers() }, [])

  const handleApprove = async (id: string) => {
    const supabase = createClient()
    await supabase.from("teachers").update({ status: "approved" }).eq("id", id)
    fetchTeachers()
  }

  const handleReject = async (id: string) => {
    const supabase = createClient()
    await supabase.from("teachers").update({ status: "rejected" }).eq("id", id)
    fetchTeachers()
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-display font-bold text-text-primary">Teacher Management</h2>
      </motion.div>

      {loading ? (
        <p className="text-text-muted">Loading...</p>
      ) : (
        <div className="space-y-3">
          {teachers.map((teacher, i) => (
            <motion.div key={teacher.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <JarvisCard glow="none" className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-5 w-5 text-accent-primary" />
                    <div>
                      <p className="font-medium text-text-primary">{teacher.display_name}</p>
                      <p className="text-xs text-text-muted">{teacher.tagline || "No tagline"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={teacher.status === "approved" ? "success" : teacher.status === "pending" ? "warning" : "destructive"}>
                      {teacher.status}
                    </Badge>
                    {teacher.status === "pending" && (
                      <div className="flex gap-1">
                        <JarvisButton variant="primary" size="sm" onClick={() => handleApprove(teacher.id)}>
                          <CheckCircle className="h-3.5 w-3.5" />
                        </JarvisButton>
                        <JarvisButton variant="danger" size="sm" onClick={() => handleReject(teacher.id)}>
                          <XCircle className="h-3.5 w-3.5" />
                        </JarvisButton>
                      </div>
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
