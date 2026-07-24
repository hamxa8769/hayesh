"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Clock, RotateCcw, ShoppingBag, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Reveal } from "@/components/motion/Reveal"
import { Stagger } from "@/components/motion/Stagger"
import { cn } from "@/lib/utils/cn"
import { createClient } from "@/lib/supabase/client"
import { formatPKR } from "@/lib/utils/format"
import { RatingStars } from "@/components/teacher-public/RatingStars"
import type { Gig, SellerLevel } from "@/types/database"

/** Narrow projection of `sellers` used for the gig's seller card. */
interface GigSellerSummary {
  id: string
  display_name: string
  tagline: string | null
  avatar_url: string | null
  level: SellerLevel | null
  is_online: boolean | null
  average_rating: number | null
  total_reviews: number | null
  response_time_hrs: number | null
}

const LEVEL_LABELS: Record<SellerLevel, string> = {
  new: "New Seller",
  rising: "Rising Talent",
  top: "Top Rated",
  elite: "Hayesh Elite",
}

function levelBadgeVariant(level: SellerLevel): "aurora" | "secondary" {
  return level === "top" || level === "elite" ? "aurora" : "secondary"
}

function getInitials(name: string | null): string {
  if (!name) return "?"
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

interface PackageTier {
  key: "basic" | "standard" | "premium"
  label: string
  title: string | null
  description: string | null
  price: number | null
  deliveryDays: number | null
  revisions: number | null
  features: string[] | null
  featured?: boolean
}

function buildTiers(gig: Gig): PackageTier[] {
  return [
    {
      key: "basic",
      label: "Basic",
      title: gig.basic_title,
      description: gig.basic_description,
      price: gig.basic_price_pkr,
      deliveryDays: gig.basic_delivery_days,
      revisions: gig.basic_revisions,
      features: gig.basic_features,
    },
    {
      key: "standard",
      label: "Standard",
      title: gig.standard_title,
      description: gig.standard_description,
      price: gig.standard_price_pkr,
      deliveryDays: gig.standard_delivery_days,
      revisions: gig.standard_revisions,
      features: gig.standard_features,
      featured: true,
    },
    {
      key: "premium",
      label: "Premium",
      title: gig.premium_title,
      description: gig.premium_description,
      price: gig.premium_price_pkr,
      deliveryDays: gig.premium_delivery_days,
      revisions: gig.premium_revisions,
      features: gig.premium_features,
    },
  ]
}

export default function GigDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [gig, setGig] = useState<Gig | null>(null)
  const [seller, setSeller] = useState<GigSellerSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: gigData } = await supabase.from("gigs").select("*").eq("id", id).single()
      setGig(gigData as Gig | null)

      if (gigData) {
        const { data: sellerData } = await supabase
          .from("sellers")
          .select("id, display_name, tagline, avatar_url, level, is_online, average_rating, total_reviews, response_time_hrs")
          .eq("id", (gigData as Gig).seller_id)
          .maybeSingle()
        setSeller(sellerData as GigSellerSummary | null)
      }
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="font-mono text-sm uppercase tracking-[0.12em] text-text-muted">Loading...</p>
      </div>
    )
  }

  if (!gig) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-text-muted">Gig not found</p>
      </div>
    )
  }

  const tiers = buildTiers(gig)

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-16 sm:px-10">
        <button
          onClick={() => router.back()}
          className="mb-8 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.1em] text-text-muted transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        <Reveal>
          {gig.gallery_urls && gig.gallery_urls.length > 0 && (
            <div className="mb-8 grid gap-2 overflow-hidden rounded-lg border border-border sm:grid-cols-3">
              {gig.gallery_urls.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt={`${gig.title} preview ${i + 1}`} className="h-48 w-full object-cover sm:h-56" />
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary" className="uppercase tracking-[0.06em]">{gig.category}</Badge>
            {gig.average_rating != null && (
              <span className="inline-flex items-center gap-1 font-mono text-xs tabular-nums text-text-muted">
                <Star className="h-3.5 w-3.5 fill-accent-secondary text-accent-secondary" />
                {gig.average_rating.toFixed(1)}
                {gig.total_orders != null && <span className="text-text-disabled">· {gig.total_orders} orders</span>}
              </span>
            )}
          </div>

          <h1 className="mt-4 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">{gig.title}</h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-text-muted">{gig.description}</p>

          {gig.tags && gig.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {gig.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-border px-3 py-1 text-xs text-text-muted">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </Reveal>

        {seller && (
          <Reveal delay={0.08} className="mt-8">
            <Link
              href={`/sellers/${seller.id}`}
              className="group flex flex-col items-start gap-4 rounded-lg border border-border bg-surface p-5 transition-colors duration-150 hover:border-line-strong hover:bg-surface-elevated sm:flex-row sm:items-center"
            >
              {seller.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={seller.avatar_url}
                  alt={seller.display_name}
                  className="h-14 w-14 shrink-0 rounded-full border border-border object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-border bg-surface-elevated font-mono text-sm font-semibold text-text-muted">
                  {getInitials(seller.display_name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-display text-base font-semibold text-text-primary group-hover:text-accent-primary">
                    {seller.display_name}
                  </p>
                  {seller.level && <Badge variant={levelBadgeVariant(seller.level)}>{LEVEL_LABELS[seller.level]}</Badge>}
                  {seller.is_online && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-accent-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent-success" aria-hidden="true" /> Online
                    </span>
                  )}
                </div>
                {seller.tagline && <p className="mt-0.5 truncate text-sm text-text-muted">{seller.tagline}</p>}
                <div className="mt-1.5 flex flex-wrap items-center gap-3">
                  <RatingStars rating={seller.average_rating} size="sm" />
                  {seller.total_reviews != null && seller.total_reviews > 0 && (
                    <span className="font-mono text-xs tabular-nums text-text-muted">({seller.total_reviews})</span>
                  )}
                  {seller.response_time_hrs != null && (
                    <span className="inline-flex items-center gap-1 font-mono text-xs tabular-nums text-text-muted">
                      <Clock className="h-3 w-3" /> Responds in {seller.response_time_hrs}h
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </Reveal>
        )}

        <Reveal delay={0.1} className="mt-12">
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Packages</span>
          <Stagger className="mt-4 grid gap-5 sm:grid-cols-3" staggerDelay={0.08}>
            {tiers.map((tier) => (
              <Reveal key={tier.key}>
                <div
                  className={cn(
                    "relative flex h-full flex-col overflow-hidden rounded-lg border p-6 transition-colors duration-150",
                    tier.featured
                      ? "border-accent-primary/40 bg-surface-elevated shadow-[0_0_30px_rgba(39,196,160,0.12)]"
                      : "border-border bg-surface hover:border-line-strong"
                  )}
                >
                  {tier.featured && <div className="absolute inset-x-0 top-0 h-[2px] aurora-bg" />}
                  <span className="font-mono text-xs uppercase tracking-[0.1em] text-text-muted">{tier.label}</span>
                  <p className="mt-1 font-display text-base font-semibold text-text-primary">{tier.title || `${tier.label} Package`}</p>
                  {tier.description && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-text-muted">{tier.description}</p>}

                  <p className={cn("mt-5 font-mono text-2xl font-bold tabular-nums", tier.featured ? "text-accent-primary" : "text-text-primary")}>
                    {formatPKR(tier.price || 0)}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs tabular-nums text-text-muted">
                    {tier.deliveryDays != null && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {tier.deliveryDays}d delivery
                      </span>
                    )}
                    {tier.revisions != null && (
                      <span className="inline-flex items-center gap-1">
                        <RotateCcw className="h-3 w-3" />
                        {tier.revisions} revisions
                      </span>
                    )}
                  </div>

                  {tier.features && tier.features.length > 0 && (
                    <ul className="mt-4 space-y-1.5 text-sm text-text-muted">
                      {tier.features.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-disabled" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Reveal>
            ))}
          </Stagger>
        </Reveal>

        {gig.faq && gig.faq.length > 0 && (
          <Reveal delay={0.15} className="mt-12">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">FAQ</span>
            <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-surface">
              {gig.faq.map((entry) => (
                <div key={entry.question} className="p-5">
                  <p className="font-medium text-text-primary">{entry.question}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{entry.answer}</p>
                </div>
              ))}
            </div>
          </Reveal>
        )}

        <Reveal delay={0.2} className="mt-12">
          <Button variant="aurora" size="lg" className="w-full sm:w-auto">
            <ShoppingBag className="h-4 w-4" /> Place Order
          </Button>
        </Reveal>
      </div>
    </div>
  )
}
