"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, ShoppingBag, Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Reveal } from "@/components/motion/Reveal"
import { Stagger } from "@/components/motion/Stagger"
import { createClient } from "@/lib/supabase/client"
import { formatPKR } from "@/lib/utils/format"

interface ShowcaseGig {
  id: string
  title: string
  category: string
  description: string
  average_rating: number | null
  total_orders: number | null
  basic_price_pkr: number | null
  seller_id: string
  sellers: { display_name: string } | null
}

export function SellerShowcase() {
  const [gigs, setGigs] = useState<ShowcaseGig[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("gigs")
        .select(
          "id, title, category, description, average_rating, total_orders, basic_price_pkr, seller_id, sellers(display_name)"
        )
        .eq("status", "approved")
        .order("total_orders", { ascending: false })
        .limit(8)

      setGigs((data || []) as unknown as ShowcaseGig[])
      setLoading(false)
    }

    load()
  }, [])

  return (
    <section className="py-24 sm:py-28">
      <div className="mx-auto w-full max-w-[1200px] px-6">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Layer Two</span>
            <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Popular services
            </h2>
            <p className="mt-3 text-text-muted">
              Fiverr-style gigs from verified sellers &mdash; one-time orders, Basic to Premium.
            </p>
          </div>
          <Link
            href="/marketplace"
            className="group flex items-center gap-1.5 font-mono text-sm uppercase tracking-[0.08em] text-text-muted transition-colors duration-150 hover:text-accent-primary"
          >
            Browse all
            <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" />
          </Link>
        </Reveal>

        <div className="mt-12">
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-56 animate-pulse rounded-lg border border-border bg-surface" />
              ))}
            </div>
          ) : gigs.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-16 text-center">
              <ShoppingBag className="mx-auto h-10 w-10 text-text-disabled" />
              <p className="mt-4 text-text-muted">Services coming soon</p>
            </div>
          ) : (
            <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" staggerDelay={0.06}>
              {gigs.map((gig) => (
                <Reveal key={gig.id}>
                  <Link href={`/marketplace/${gig.id}`} className="group block h-full">
                    <div className="relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface transition-all duration-150 group-hover:-translate-y-0.5 group-hover:border-line-strong group-hover:bg-surface-elevated group-hover:shadow-[0_12px_30px_rgba(0,0,0,0.45),0_0_24px_rgba(245,184,78,0.12)]">
                      <div className="aurora-bg h-1.5 w-full opacity-70" />
                      <div className="flex flex-1 flex-col p-6">
                        <div className="flex items-center justify-between gap-3">
                          <Badge variant="secondary" className="uppercase tracking-[0.06em]">
                            {gig.category}
                          </Badge>
                          {gig.average_rating != null && (
                            <span className="inline-flex items-center gap-1 font-mono text-xs tabular-nums text-text-muted">
                              <Star className="h-3 w-3 fill-accent-secondary text-accent-secondary" />
                              {gig.average_rating.toFixed(1)}
                            </span>
                          )}
                        </div>

                        <h3 className="mt-4 font-display text-base font-semibold leading-snug text-text-primary">
                          {gig.title}
                        </h3>
                        <p className="mt-1 text-xs text-text-muted">
                          by {gig.sellers?.display_name || "Hayesh Seller"}
                        </p>
                        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-text-muted">
                          {gig.description}
                        </p>

                        <div className="mt-6 flex items-end justify-between border-t border-border pt-4">
                          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-disabled">
                            From
                          </span>
                          <span className="font-mono text-lg font-semibold tabular-nums text-accent-primary">
                            {formatPKR(gig.basic_price_pkr || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </Stagger>
          )}
        </div>
      </div>
    </section>
  )
}
