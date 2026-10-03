"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, ShoppingBag } from "lucide-react"
import { JarvisInput } from "@/components/ui/jarvis-input"
import { GigCard } from "@/components/marketplace/GigCard"
import { GigCardSkeleton } from "@/components/cards/GigCard"
import type { GigCardSeller } from "@/components/cards/GigCard"
import { Reveal } from "@/components/motion/Reveal"
import { Stagger } from "@/components/motion/Stagger"
import { cn } from "@/lib/utils/cn"
import { createClient } from "@/lib/supabase/client"
import type { Gig } from "@/types/database"

const ALL_CATEGORY = "All"

type GigWithSeller = Gig & { sellers: GigCardSeller | null }

export default function MarketplacePage() {
  const [gigs, setGigs] = useState<GigWithSeller[]>([])
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY)
  const [loading, setLoading] = useState(true)
  const [featuredSellers, setFeaturedSellers] = useState<Set<string>>(new Set())

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("gigs").select("*, sellers(display_name, avatar_url, level)").eq("status", "approved").order("created_at", { ascending: false })
      const rows = (data || []) as unknown as GigWithSeller[]
      // Featured status lives on the seller row — second query, then featured sellers' gigs first (stable sort).
      const sellerIds = Array.from(new Set(rows.map((g) => g.seller_id).filter(Boolean)))
      const featured = new Set<string>()
      if (sellerIds.length > 0) {
        const { data: sellerRows } = await supabase.from("sellers").select("id, featured, featured_until").in("id", sellerIds)
        for (const s of (sellerRows || []) as Array<{ id: string; featured: boolean | null; featured_until: string | null }>) {
          if (s.featured && (!s.featured_until || new Date(s.featured_until).getTime() > Date.now())) featured.add(s.id)
        }
      }
      setFeaturedSellers(featured)
      setGigs([...rows].sort((a, b) => Number(featured.has(b.seller_id)) - Number(featured.has(a.seller_id))))
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
      <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10">
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
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4" aria-label="Loading gigs">
              {Array.from({ length: 8 }).map((_, i) => (
                <GigCardSkeleton key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-16 text-center">
              <ShoppingBag className="mx-auto h-10 w-10 text-text-disabled" />
              <p className="mt-4 text-text-muted">No gigs found</p>
            </div>
          ) : (
            <Stagger className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4" staggerDelay={0.04}>
              {filtered.map((g) => (
                <Reveal key={g.id} className="h-full">
                  <GigCard gig={g} seller={g.sellers} featured={featuredSellers.has(g.seller_id) || undefined} />
                </Reveal>
              ))}
            </Stagger>
          )}
        </div>
      </div>
    </div>
  )
}
