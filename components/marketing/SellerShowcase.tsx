"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, ShoppingBag, TriangleAlert } from "lucide-react"
import { GigCard, GigCardSkeleton, minPrice, type GigCardSeller } from "@/components/cards/GigCard"
import { Reveal } from "@/components/motion/Reveal"
import { Stagger } from "@/components/motion/Stagger"
import { createClient } from "@/lib/supabase/client"

interface ShowcaseGig {
  id: string
  title: string
  category: string
  average_rating: number | null
  total_orders: number | null
  basic_price_pkr: number | null
  standard_price_pkr: number | null
  premium_price_pkr: number | null
  basic_delivery_days: number | null
  gallery_urls: string[] | null
  is_featured: boolean | null
  featured_until: string | null
  seller_id: string
  sellers: GigCardSeller | null
}

function isFeatured(gig: ShowcaseGig): boolean {
  return Boolean(gig.is_featured) && (!gig.featured_until || new Date(gig.featured_until).getTime() > Date.now())
}

export function SellerShowcase() {
  const [gigs, setGigs] = useState<ShowcaseGig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const supabase = createClient()
      const { data, error: queryError } = await supabase
        .from("gigs")
        .select(
          "id, title, category, average_rating, total_orders, basic_price_pkr, standard_price_pkr, premium_price_pkr, basic_delivery_days, gallery_urls, is_featured, featured_until, seller_id, sellers(display_name, avatar_url, level)"
        )
        .eq("status", "approved")
        .order("total_orders", { ascending: false })
        .limit(8)

      if (cancelled) return
      if (queryError) {
        setError(true)
        setLoading(false)
        return
      }

      setGigs((data || []) as unknown as ShowcaseGig[])
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="py-24 sm:py-28">
      <div className="mx-auto w-full max-w-[1200px] px-6">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Layer Two</span>
            <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Popular services &amp; packages
            </h2>
            <p className="mt-3 text-text-muted">
              Fiverr-style gigs from verified sellers &mdash; one-time orders across Basic, Standard, and Premium.
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
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading services">
              {Array.from({ length: 4 }).map((_unused, i) => (
                <GigCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-border bg-surface p-16 text-center">
              <TriangleAlert className="mx-auto h-10 w-10 text-accent-warning" />
              <p className="mt-4 text-text-muted">Couldn&apos;t load services right now. Please try again shortly.</p>
            </div>
          ) : gigs.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-16 text-center">
              <ShoppingBag className="mx-auto h-10 w-10 text-text-disabled" />
              <p className="mt-4 text-text-muted">Services coming soon</p>
            </div>
          ) : (
            <Stagger className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4" staggerDelay={0.05}>
              {gigs.map((gig) => (
                <Reveal key={gig.id} className="h-full">
                  <GigCard
                    id={gig.id}
                    title={gig.title}
                    category={gig.category}
                    coverUrl={gig.gallery_urls && gig.gallery_urls.length > 0 ? gig.gallery_urls[0] : null}
                    seller={gig.sellers}
                    rating={gig.average_rating}
                    count={gig.total_orders}
                    startingPrice={minPrice(gig.basic_price_pkr, gig.standard_price_pkr, gig.premium_price_pkr)}
                    deliveryDays={gig.basic_delivery_days}
                    featured={isFeatured(gig)}
                  />
                </Reveal>
              ))}
            </Stagger>
          )}
        </div>
      </div>
    </section>
  )
}
