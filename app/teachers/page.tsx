"use client"

import { useEffect, useState } from "react"
import { Search } from "lucide-react"
import { TeacherCard, TeacherCardSkeleton, teacherCardPropsFromRow } from "@/components/cards/TeacherCard"
import { Reveal } from "@/components/motion/Reveal"
import { Stagger } from "@/components/motion/Stagger"
import { createClient } from "@/lib/supabase/client"
import type { Teacher } from "@/types/database"

function isFeatured(t: Pick<Teacher, "featured" | "featured_until">): boolean {
  return Boolean(t.featured) && (!t.featured_until || new Date(t.featured_until).getTime() > Date.now())
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("teachers").select("*").eq("status", "approved").order("average_rating", { ascending: false })
      const rows = (data || []) as Teacher[]
      // Unexpired featured teachers first; Array.sort is stable so the rating order is kept within each group.
      setTeachers([...rows].sort((a, b) => Number(isFeatured(b)) - Number(isFeatured(a))))
      setLoading(false)
    }
    load()
  }, [])

  const filtered = teachers.filter((t) => {
    if (!search) return true
    const q = search.toLowerCase()
    return t.display_name?.toLowerCase().includes(q) || t.tagline?.toLowerCase().includes(q) || (t.subjects || []).some((s: { subject?: string }) => s.subject?.toLowerCase().includes(q))
  })

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10">
        <Reveal>
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Layer One — Teacher Profiles</span>
          <h1 className="mt-3 text-balance font-display text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl">
            Find your <span className="aurora-text">teacher</span>
          </h1>
          <p className="mt-3 max-w-xl text-text-muted">
            Browse verified educators and book a free demo lesson before you subscribe.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-10">
          <div className="relative max-w-lg">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by subject or name..."
              className="h-12 w-full rounded border border-border bg-surface pl-11 pr-4 text-sm text-text-primary placeholder:text-text-disabled transition-colors duration-150 focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
            />
          </div>
          {!loading && (
            <p className="mt-3 font-mono text-xs tabular-nums text-text-muted">
              {filtered.length} {filtered.length === 1 ? "teacher" : "teachers"} available
            </p>
          )}
        </Reveal>

        <div className="mt-10">
          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading teachers">
              {Array.from({ length: 6 }).map((_, i) => (
                <TeacherCardSkeleton key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-16 text-center">
              <p className="text-text-muted">No teachers found</p>
            </div>
          ) : (
            <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" staggerDelay={0.05}>
              {filtered.map((t) => (
                <Reveal key={t.id} className="h-full">
                  <TeacherCard {...teacherCardPropsFromRow(t)} />
                </Reveal>
              ))}
            </Stagger>
          )}
        </div>
      </div>
    </div>
  )
}
