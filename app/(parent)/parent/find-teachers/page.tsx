"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Search, Star, GraduationCap, ArrowRight } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisInput } from "@/components/ui/jarvis-input"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import type { Teacher } from "@/types/database"

export default function FindTeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTeachers = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("teachers")
        .select("*")
        .eq("status", "approved")
        .order("average_rating", { ascending: false })

      setTeachers((data || []) as Teacher[])
      setLoading(false)
    }
    fetchTeachers()
  }, [])

  const filtered = search
    ? teachers.filter(t =>
        t.display_name.toLowerCase().includes(search.toLowerCase()) ||
        t.tagline?.toLowerCase().includes(search.toLowerCase())
      )
    : teachers

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-display font-bold text-text-primary">Find Teachers</h2>
        <p className="text-text-muted">Browse verified tutors for your children.</p>
      </motion.div>

      <JarvisInput
        placeholder="Search teachers..."
        icon={<Search className="h-4 w-4" />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <p className="text-text-muted">Loading teachers...</p>
      ) : filtered.length === 0 ? (
        <JarvisCard glow="none" className="p-8 text-center">
          <GraduationCap className="mx-auto h-12 w-12 text-text-disabled mb-3" />
          <p className="text-text-muted">No teachers found</p>
        </JarvisCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((teacher, i) => (
            <motion.div
              key={teacher.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <JarvisCard glow="violet" className="p-5 flex flex-col h-full">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-primary/10">
                    <GraduationCap className="h-6 w-6 text-accent-primary" />
                  </div>
                  {teacher.translation_enabled && (
                    <Badge variant="cyan">✦ Multilingual</Badge>
                  )}
                </div>
                <h3 className="font-display text-lg font-semibold text-text-primary">{teacher.display_name}</h3>
                <p className="text-sm text-text-muted mt-1">{teacher.tagline}</p>
                <div className="mt-auto pt-4 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 fill-accent-warning text-accent-warning" />
                    <span className="text-sm font-medium">{teacher.average_rating?.toFixed(1) || "New"}</span>
                  </div>
                  <p className="font-mono text-lg font-bold text-accent-primary">
                    ₨{(teacher.private_price_pkr || teacher.standard_price_pkr || teacher.group_price_pkr || 0).toLocaleString()}
                  </p>
                </div>
                <JarvisButton variant="secondary" size="sm" className="w-full mt-4">
                  View Profile <ArrowRight className="h-3.5 w-3.5" />
                </JarvisButton>
              </JarvisCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
