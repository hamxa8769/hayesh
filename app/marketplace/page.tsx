"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Search, ShoppingBag, Star } from "lucide-react"
import { JarvisInput } from "@/components/ui/jarvis-input"
import { Badge } from "@/components/ui/badge"
import { Reveal } from "@/components/motion/Reveal"
import { Stagger } from "@/components/motion/Stagger"
import { cn } from "@/lib/utils/cn"
import { createClient } from "@/lib/supabase/client"
import { formatPKR } from "@/lib/utils/format"
import type { Gig } from "@/types/database"

const ALL_CATEGORY = "All"

export default function MarketplacePage() {
  const [gigs, setGigs] = useState<Gig[]>([])
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("gigs").select("*").eq("status", "approved").order("created_at", { ascending: false })
      setGigs((data || []) as Gig[])
      setLoading(false)
    }
    load()
  }, [])

  const categories = useMemo(() => {
    const unique = Array.from(new Set(gigs.map((g) => g.category).filter(Boolean)))
    return [ALL_CATEGORY, ...unique]
  }, [gigs])

  const filtered = gigs.filter((g) => {
    const matchesCategory = activeCategory === ALL_CATEGORY || g.category === activeCategory
    if (!matchesCategory) return false
    if (!search) return true
    const q = search.toLowerCase()
    return g.title?.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q) || g.category?.toLowerCase().includes(q)
  })

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
        <Reveal className="max-w-2xl">
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Human Seller Marketplace</span>
          <h1 className="mt-3 text-balance font-display text-4xl font-bold tracking-tight sm:text-5xl">Marketplace</h1>
          <p className="mt-3 text-text-muted">Freelance services from verified sellers — one-time orders, Basic to Premium.</p>
        </Reveal>

        <Reveal delay={0.1} className="mt-8 max-w-md">
          <JarvisInput
            placeholder="Search gigs..."
            icon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Reveal>

        {categories.length > 1 && (
          <Reveal delay={0.15} className="mt-6 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 font-mono text-xs uppercase tracking-[0.08em] transition-colors duration-150",
                  activeCategory === cat
                    ? "border-accent-primary/50 bg-accent-primary/10 text-accent-primary"
                    : "border-border bg-surface text-text-muted hover:border-line-strong hover:text-text-primary"
                )}
              >
                {cat}
              </button>
            ))}
          </Reveal>
        )}

        <div className="mt-10">
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading gigs">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-56 animate-pulse rounded-lg border border-border bg-surface" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-16 text-center">
              <ShoppingBag className="mx-auto h-10 w-10 text-text-disabled" />
              <p className="mt-4 text-text-muted">No gigs found</p>
            </div>
          ) : (
            <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" staggerDelay={0.06}>
              {filtered.map((g) => (
                <Reveal key={g.id}>
                  <Link href={`/marketplace/${g.id}`} className="group block h-full">
                    <div className="relative flex h-full flex-col rounded-lg border border-border bg-surface p-6 transition-all duration-150 hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface-elevated hover:shadow-[0_12px_30px_rgba(0,0,0,0.45),0_0_24px_rgba(39,196,160,0.1)]">
                      <div className="flex items-center justify-between gap-3">
                        <Badge variant="secondary" className="uppercase tracking-[0.06em]">{g.category}</Badge>
                        {g.average_rating != null && (
                          <span className="inline-flex items-center gap-1 font-mono text-xs tabular-nums text-text-muted">
                            <Star className="h-3 w-3 fill-accent-secondary text-accent-secondary" />
                            {g.average_rating.toFixed(1)}
                            {g.total_orders != null && <span className="text-text-disabled">({g.total_orders})</span>}
                          </span>
                        )}
                      </div>

                      <h3 className="mt-4 font-display text-lg font-semibold leading-snug text-text-primary">{g.title}</h3>
                      <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-text-muted">{g.description}</p>

                      <div className="mt-6 flex items-end justify-between border-t border-border pt-4">
                        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-disabled">Starting at</span>
                        <span className="font-mono text-lg font-semibold tabular-nums text-accent-primary">{formatPKR(g.basic_price_pkr || 0)}</span>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </Stagger>
          )}
        </div>
      </div>
    </div>
  )
}
