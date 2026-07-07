"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { GraduationCap, Search, Filter, Star, ArrowRight } from "lucide-react"
import { Navbar } from "@/components/layout/Navbar"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { JarvisInput } from "@/components/ui/jarvis-input"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { formatPKR } from "@/lib/utils/format"
import type { Teacher } from "@/types/database"

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

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

  const filtered = teachers.filter((t) => {
    if (!search) return true
    const q = search.toLowerCase()
    const subjects = (t.subjects || []) as Array<{ subject: string }>
    return (
      t.display_name.toLowerCase().includes(q) ||
      t.tagline?.toLowerCase().includes(q) ||
      subjects.some((s) => s.subject.toLowerCase().includes(q))
    )
  })

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-24 pb-16 px-6">
        <div className="mx-auto max-w-6xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <h1 className="font-display text-3xl font-bold text-text-primary sm:text-4xl">Find Your Perfect Teacher</h1>
            <p className="mt-2 text-text-muted">Browse verified tutors across Mathematics, Science, Languages, and more.</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8 flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <JarvisInput
                placeholder="Search by subject, name, or keyword..."
                icon={<Search className="h-4 w-4" />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </motion.div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div key={i} className="h-2 w-2 rounded-full bg-accent-primary" animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
                ))}
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <JarvisCard glow="none" className="p-8 text-center">
              <GraduationCap className="mx-auto h-12 w-12 text-text-disabled mb-3" />
              <p className="text-text-muted">No teachers found{search ? " matching your search" : ""}.</p>
            </JarvisCard>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((teacher, i) => {
                const subjects = (teacher.subjects || []) as Array<{ subject: string }>
                const minPrice = Math.min(
                  teacher.group_price_pkr || Infinity,
                  teacher.standard_price_pkr || Infinity,
                  teacher.private_price_pkr || Infinity
                )
                return (
                  <motion.div key={teacher.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.05 }}>
                    <Link href={`/teachers/${teacher.id}`}>
                      <JarvisCard glow="violet" className="p-6 h-full flex flex-col cursor-pointer hover:border-accent-primary/50 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-primary/10">
                            <GraduationCap className="h-6 w-6 text-accent-primary" />
                          </div>
                          {teacher.translation_enabled && <Badge variant="cyan">✦ Multilingual</Badge>}
                        </div>
                        <h3 className="font-display text-lg font-semibold text-text-primary">{teacher.display_name}</h3>
                        <p className="text-sm text-text-muted mt-1">{teacher.tagline || "Verified teacher"}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {subjects.slice(0, 3).map((s) => (
                            <Badge key={s.subject} variant="secondary">{s.subject}</Badge>
                          ))}
                        </div>
                        <div className="mt-auto pt-4 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Star className="h-4 w-4 fill-accent-warning text-accent-warning" />
                            <span className="text-sm font-medium text-text-primary">{teacher.average_rating || "New"}</span>
                            <span className="text-xs text-text-muted">({teacher.total_reviews || 0})</span>
                          </div>
                          {minPrice < Infinity && (
                            <div className="text-right">
                              <p className="text-xs text-text-muted">from</p>
                              <p className="font-mono text-lg font-bold text-accent-primary">{formatPKR(minPrice)}</p>
                            </div>
                          )}
                        </div>
                        <JarvisButton variant="secondary" size="sm" className="w-full mt-4">
                          View Profile <ArrowRight className="h-3.5 w-3.5" />
                        </JarvisButton>
                      </JarvisCard>
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
