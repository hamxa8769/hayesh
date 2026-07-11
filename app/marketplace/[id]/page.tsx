"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Clock, RotateCcw, ShoppingBag, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Reveal } from "@/components/motion/Reveal"
import { Stagger } from "@/components/motion/Stagger"
import { cn } from "@/lib/utils/cn"
import { createClient } from "@/lib/supabase/client"
import { formatPKR } from "@/lib/utils/format"
import type { Gig } from "@/types/database"

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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("gigs").select("*").eq("id", id).single()
      setGig(data as Gig | null)
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
              {gig.gallery_urls.slice(0, 3).map((url, i) => (
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
        </Reveal>

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
