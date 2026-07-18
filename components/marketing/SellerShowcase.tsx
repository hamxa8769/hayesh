"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, ShoppingBag, Star, TriangleAlert } from "lucide-react"
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
  standard_price_pkr: number | null
  premium_price_pkr: number | null
  basic_delivery_days: number | null
  seller_id: string
  sellers: { display_name: string } | null
}

interface PackageTier {
  label: string
  price: number | null
}

function tiersFor(gig: ShowcaseGig): PackageTier[] {
  return [
    { label: "Basic", price: gig.basic_price_pkr },
    { label: "Standard", price: gig.standard_price_pkr },
    { label: "Premium", price: gig.premium_price_pkr },
  ]
}

function PackageTierList({ tiers, dense = false }: { tiers: PackageTier[]; dense?: boolean }) {
  return (
    <dl className={dense ? "mt-3 space-y-1.5" : "mt-5 space-y-2"}>
      {tiers.map((tier) => (
        <div key={tier.label} className="flex items-center justify-between gap-3">
          <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">{tier.label}</dt>
          <dd className="font-mono text-sm font-semibold tabular-nums text-text-primary">
            {tier.price != null ? formatPKR(tier.price) : "—"}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function FeaturedGigCard({ gig }: { gig: ShowcaseGig }) {
  return (
    <Link href={`/marketplace/${gig.id}`} className="group block h-full">
      <article className="relative flex h-full flex-col justify-between overflow-hidden rounded-lg border border-line-strong bg-surface-elevated p-8 transition-all duration-150 group-hover:border-accent-secondary/40 group-hover:shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_30px_rgba(245,184,78,0.14)]">
        <div className="aurora-bg absolute inset-x-0 top-0 h-[2px]" />

        <div>
          <div className="flex items-center justify-between gap-3">
            <Badge variant="secondary" className="uppercase tracking-[0.06em]">
              {gig.category}
            </Badge>
            {gig.average_rating != null && (
              <span className="inline-flex items-center gap-1 font-mono text-xs tabular-nums text-text-muted">
                <Star className="h-3 w-3 fill-accent-secondary text-accent-secondary" />
                {gig.average_rating.toFixed(1)}
                {gig.total_orders != null && (
                  <span className="text-text-disabled">&middot; {gig.total_orders} orders</span>
                )}
              </span>
            )}
          </div>

          <h3 className="mt-5 font-display text-xl font-semibold leading-snug text-text-primary">{gig.title}</h3>
          <p className="mt-1 text-xs text-text-muted">by {gig.sellers?.display_name || "Hayesh Seller"}</p>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-text-muted">{gig.description}</p>
        </div>

        <div className="mt-8 grid gap-8 border-t border-border pt-6 sm:grid-cols-2">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-disabled">One-time order</span>
            <p className="mt-2 max-w-[26ch] text-xs leading-relaxed text-text-muted">
              {gig.basic_delivery_days
                ? `Basic delivers in ${gig.basic_delivery_days} day${gig.basic_delivery_days === 1 ? "" : "s"}.`
                : "Pick a package and pay once."}
            </p>
          </div>
          <PackageTierList tiers={tiersFor(gig)} />
        </div>
      </article>
    </Link>
  )
}

function CompactGigCard({ gig }: { gig: ShowcaseGig }) {
  return (
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

          <h3 className="mt-4 font-display text-base font-semibold leading-snug text-text-primary">{gig.title}</h3>
          <p className="mt-1 text-xs text-text-muted">by {gig.sellers?.display_name || "Hayesh Seller"}</p>

          <div className="mt-auto border-t border-border pt-4">
            <PackageTierList tiers={tiersFor(gig)} dense />
          </div>
        </div>
      </div>
    </Link>
  )
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
          "id, title, category, description, average_rating, total_orders, basic_price_pkr, standard_price_pkr, premium_price_pkr, basic_delivery_days, seller_id, sellers(display_name)"
        )
        .eq("status", "approved")
        .order("total_orders", { ascending: false })
        .limit(7)

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

  const [featured, ...rest] = gigs

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
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="h-72 animate-pulse rounded-lg border border-border bg-surface sm:col-span-2 lg:row-span-2" />
              {Array.from({ length: 3 }).map((_unused, i) => (
                <div key={i} className="h-56 animate-pulse rounded-lg border border-border bg-surface" />
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
            <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" staggerDelay={0.06}>
              {featured && (
                <Reveal className="sm:col-span-2 lg:col-span-2 lg:row-span-2">
                  <FeaturedGigCard gig={featured} />
                </Reveal>
              )}
              {rest.map((gig) => (
                <Reveal key={gig.id}>
                  <CompactGigCard gig={gig} />
                </Reveal>
              ))}
            </Stagger>
          )}
        </div>
      </div>
    </section>
  )
}
