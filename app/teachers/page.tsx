"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Search, Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Reveal } from "@/components/motion/Reveal"
import { Stagger } from "@/components/motion/Stagger"
import { createClient } from "@/lib/supabase/client"
import { formatPKR } from "@/lib/utils/format"
import type { Teacher } from "@/types/database"

function getInitials(name: string | null): string {
  if (!name) return "?"
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

export default function TeachersPage() {
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
    return t.display_name?.toLowerCase().includes(q) || t.tagline?.toLowerCase().includes(q) || (t.subjects || []).some((s: { subject?: string }) => s.subject?.toLowerCase().includes(q))
  })

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
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
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-64 animate-pulse rounded-lg border border-border bg-surface" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-16 text-center">
              <p className="text-text-muted">No teachers found</p>
            </div>
          ) : (
            <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" staggerDelay={0.05}>
              {filtered.map((t) => {
                const subs = (t.subjects || []) as Array<{ subject: string }>
                const visibleSubs = subs.slice(0, 3)
                const overflowCount = subs.length - visibleSubs.length
                const min = Math.min(t.group_price_pkr || Infinity, t.standard_price_pkr || Infinity, t.private_price_pkr || Infinity)

                return (
                  <Reveal key={t.id}>
                    <Link href={`/teachers/${t.id}`} className="group block h-full">
                      <article className="relative flex h-full flex-col justify-between rounded-lg border border-border bg-surface p-6 transition-all duration-150 group-hover:border-line-strong group-hover:bg-surface-elevated group-hover:shadow-[0_0_28px_rgba(39,196,160,0.12)]">
                        <div>
                          <div className="flex items-center gap-3">
                            {t.profile_photo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={t.profile_photo_url}
                                alt={t.display_name}
                                className="h-12 w-12 rounded-full border border-border object-cover"
                              />
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-elevated font-mono text-sm font-semibold text-text-muted">
                                {getInitials(t.display_name)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <h3 className="truncate font-display text-lg font-semibold text-text-primary">{t.display_name}</h3>
                              <p className="truncate text-sm text-text-muted">{t.tagline || "Verified teacher"}</p>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {visibleSubs.map((s) => (
                              <span key={s.subject} className="rounded-full border border-border px-2.5 py-1 text-xs text-text-muted">
                                {s.subject}
                              </span>
                            ))}
                            {overflowCount > 0 && (
                              <span className="rounded-full border border-border px-2.5 py-1 text-xs text-text-disabled">
                                +{overflowCount}
                              </span>
                            )}
                          </div>

                          {t.translation_enabled && (
                            <Badge variant="aurora" className="mt-3">✦ Multilingual</Badge>
                          )}
                        </div>

                        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                          <span className="flex items-center gap-1.5 font-mono text-sm tabular-nums text-text-primary">
                            <Star className="h-3.5 w-3.5 text-text-muted" />
                            {t.average_rating ? t.average_rating.toFixed(1) : "New"}
                          </span>
                          {min < Infinity && (
                            <span className="font-mono text-sm font-semibold tabular-nums text-text-primary">
                              {formatPKR(min)}
                            </span>
                          )}
                        </div>
                      </article>
                    </Link>
                  </Reveal>
                )
              })}
            </Stagger>
          )}
        </div>
      </div>
    </div>
  )
}
