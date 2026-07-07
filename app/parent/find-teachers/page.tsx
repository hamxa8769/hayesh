"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Search, Star } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisInput } from "@/components/ui/jarvis-input"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { formatPKR } from "@/lib/utils/format"
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

      {loading ? <p className="text-text-muted">Loading...</p> : filtered.length === 0 ? (
        <JarvisCard glow="none" className="p-8 text-center"><p className="text-text-muted">No teachers found</p></JarvisCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t, i) => {
            const subs = (t.subjects || []) as Array<{ subject: string }>
            const min = Math.min(t.group_price_pkr || Infinity, t.standard_price_pkr || Infinity, t.private_price_pkr || Infinity)
            return (
              <motion.div key={t.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link href={`/teachers/${t.id}`}>
                  <JarvisCard glow="violet" className="p-5 h-full cursor-pointer hover:border-accent-primary/50 transition-colors">
                    <h3 className="font-display text-lg font-bold text-text-primary">{t.display_name}</h3>
                    <p className="text-sm text-text-muted mt-1">{t.tagline || "Verified teacher"}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {subs.slice(0, 3).map((s) => <Badge key={s.subject} variant="secondary">{s.subject}</Badge>)}
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="flex items-center gap-1 text-sm"><Star className="h-4 w-4 text-accent-warning" /> {t.average_rating || "New"}</span>
                      {min < Infinity && <span className="font-mono text-sm font-bold text-accent-primary">{formatPKR(min)}</span>}
                    </div>
                  </JarvisCard>
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
