"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { GraduationCap } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils/format"
import type { Teacher } from "@/types/database"

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const { data } = await supabase.from("teachers").select("*").order("created_at", { ascending: false })
    setTeachers((data || []) as Teacher[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const approve = async (id: string) => {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    await supabase.from("teachers").update({ status: "approved" }).eq("id", id)
    load()
  }

  const revoke = async (id: string) => {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    await supabase.from("teachers").update({ status: "revoked" }).eq("id", id)
    load()
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-2xl font-bold">Teacher Management</h2>
      </motion.div>

      {loading ? <p className="text-text-muted">Loading...</p> : teachers.length === 0 ? (
        <JarvisCard glow="none" className="p-8 text-center">
          <GraduationCard className="mx-auto h-12 w-12 text-text-disabled mb-3" />
          <p className="text-text-muted">No teachers yet</p>
        </JarvisCard>
      ) : (
        <div className="space-y-3">
          {teachers.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <JarvisCard glow="none" className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-text-primary">{t.display_name || "Unnamed"}</p>
                    <p className="text-xs text-text-muted">{t.created_at ? formatDate(t.created_at) : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={t.status === "approved" ? "success" : t.status === "pending" ? "warning" : "destructive"}>{t.status}</Badge>
                    {t.status === "pending" && <JarvisButton variant="primary" size="sm" onClick={() => approve(t.id)}>Approve</JarvisButton>}
                    {t.status === "approved" && <JarvisButton variant="danger" size="sm" onClick={() => revoke(t.id)}>Revoke</JarvisButton>}
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

// Fix: GraduationCap not GradCard
const GraduationCard = GraduationCap
