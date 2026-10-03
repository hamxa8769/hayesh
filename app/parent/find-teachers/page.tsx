"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Search } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisInput } from "@/components/ui/jarvis-input"
import { TeacherCard, TeacherCardSkeleton, teacherCardPropsFromRow } from "@/components/cards/TeacherCard"
import { createClient } from "@/lib/supabase/client"
import type { Teacher } from "@/types/database"

export default function FindTeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("teachers").select("*").eq("status", "approved").order("average_rating", { ascending: false })
      setTeachers((data || []) as Teacher[])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = teachers.filter((t) => {
    if (!search) return true
    const q = search.toLowerCase()
    const subs = (t.subjects || []) as Array<{ subject: string }>
    return t.display_name.toLowerCase().includes(q) || t.tagline?.toLowerCase().includes(q) || subs.some((s) => s.subject.toLowerCase().includes(q))
  })

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-2xl font-bold">Find Teachers</h2>
      </motion.div>

      <JarvisInput placeholder="Search by subject or name..." icon={<Search className="h-4 w-4" />} value={search} onChange={(e) => setSearch(e.target.value)} />

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading teachers">
          {Array.from({ length: 6 }).map((_, i) => (
            <TeacherCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <JarvisCard glow="none" className="p-8 text-center"><p className="text-text-muted">No teachers found</p></JarvisCard>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t, i) => (
            <motion.div key={t.id} className="h-full" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <TeacherCard {...teacherCardPropsFromRow(t)} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
