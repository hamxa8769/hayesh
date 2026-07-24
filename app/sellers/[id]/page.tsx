"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, ShoppingBag } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Reveal } from "@/components/motion/Reveal"
import { Stagger } from "@/components/motion/Stagger"
import { createClient } from "@/lib/supabase/client"
import { formatDateTime } from "@/lib/utils/format"
import { RatingStars } from "@/components/teacher-public/RatingStars"
import { GigCard } from "@/components/marketplace/GigCard"
import type { Gig, Seller, SellerLevel } from "@/types/database"

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

interface StatTile {
  label: string
  value: string
}

function buildStatTiles(seller: Seller): StatTile[] {
  const tiles: StatTile[] = []
  if (seller.total_orders) tiles.push({ label: "Orders", value: seller.total_orders.toLocaleString() })
  if (seller.completed_orders) tiles.push({ label: "Completed", value: seller.completed_orders.toLocaleString() })
  if (seller.average_rating) tiles.push({ label: "Avg Rating", value: seller.average_rating.toFixed(1) })
  if (seller.response_time_hrs) tiles.push({ label: "Response Time", value: `${seller.response_time_hrs}h` })
  return tiles
}

export default function SellerDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const sellerId = String(id)
  const [seller, setSeller] = useState<Seller | null>(null)
  const [gigs, setGigs] = useState<Gig[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: sellerData } = await supabase.from("sellers").select("*").eq("id", sellerId).maybeSingle()
      setSeller(sellerData as Seller | null)

      if (sellerData) {
        const { data: gigsData } = await supabase
          .from("gigs")
          .select("*")
          .eq("seller_id", sellerId)
          .eq("status", "approved")
          .order("created_at", { ascending: false })
        setGigs((gigsData || []) as Gig[])
      }
      setLoading(false)
    }
    load()
  }, [sellerId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="font-mono text-sm text-text-muted">Loading...</p>
      </div>
    )
  }

  if (!seller) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-text-muted">Seller not found</p>
      </div>
    )
  }

  const skills = seller.skills || []
  const languages = seller.languages || []
  const portfolioUrls = seller.portfolio_urls || []
  const statTiles = buildStatTiles(seller)

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-16 sm:px-10">
        <button
          onClick={() => router.back()}
          className="mb-8 flex items-center gap-2 text-sm text-text-muted transition-colors duration-150 hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Identity header */}
        <Reveal>
          <div className="relative overflow-hidden rounded-lg border border-border bg-surface p-8">
            <div className="absolute inset-x-0 top-0 h-[2px] aurora-bg" />
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              {seller.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={seller.avatar_url}
                  alt={seller.display_name}
                  className="h-24 w-24 shrink-0 rounded-full border border-border object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-border bg-surface-elevated font-mono text-xl font-semibold text-text-muted">
                  {getInitials(seller.display_name)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-balance font-display text-3xl font-semibold tracking-tight text-text-primary">
                    {seller.display_name}
                  </h1>
                  {seller.level && <Badge variant={levelBadgeVariant(seller.level)}>{LEVEL_LABELS[seller.level]}</Badge>}
                </div>
                <p className="mt-1 text-text-muted">{seller.tagline || "Freelance seller"}</p>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <RatingStars rating={seller.average_rating} size="sm" />
                  {(seller.total_reviews ?? 0) > 0 && (
                    <span className="font-mono text-xs tabular-nums text-text-muted">({seller.total_reviews})</span>
                  )}
                  {seller.is_online ? (
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.08em] text-accent-success">
                      <span className="h-2 w-2 rounded-full bg-accent-success" aria-hidden="true" /> Online
                    </span>
                  ) : seller.last_seen_at ? (
                    <span className="font-mono text-xs text-text-muted">Last seen {formatDateTime(seller.last_seen_at)}</span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Stats strip */}
        {statTiles.length > 0 && (
          <Reveal delay={0.03} className="mt-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {statTiles.map((tile) => (
                <div key={tile.label} className="rounded-lg border border-border bg-surface p-4 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{tile.label}</p>
                  <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-text-primary">{tile.value}</p>
                </div>
              ))}
            </div>
          </Reveal>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <Reveal delay={0.06} className="mt-8">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Skills</span>
            <div className="mt-3 flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span key={skill} className="rounded-full border border-border px-3 py-1 text-sm text-text-muted">
                  {skill}
                </span>
              ))}
            </div>
          </Reveal>
        )}

        {/* Languages */}
        {languages.length > 0 && (
          <Reveal delay={0.09} className="mt-8">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Languages</span>
            <div className="mt-3 flex flex-wrap gap-2">
              {languages.map((lang) => (
                <span
                  key={lang}
                  className="rounded-full border border-accent-primary/30 bg-accent-primary/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.06em] text-accent-primary"
                >
                  {lang}
                </span>
              ))}
            </div>
          </Reveal>
        )}

        {/* Portfolio */}
        {portfolioUrls.length > 0 && (
          <Reveal delay={0.12} className="mt-8">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Portfolio</span>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {portfolioUrls.map((url, i) => (
                <div key={url} className="aspect-video overflow-hidden rounded-lg border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`${seller.display_name} portfolio item ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          </Reveal>
        )}

        {/* Gigs by this seller */}
        <Reveal delay={0.15} className="mt-8">
          <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
            <ShoppingBag className="h-3.5 w-3.5" /> Gigs by {seller.display_name}
          </span>
          {gigs.length === 0 ? (
            <div className="mt-3 rounded-lg border border-border bg-surface p-10 text-center">
              <p className="text-sm text-text-muted">No active gigs yet</p>
            </div>
          ) : (
            <Stagger className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" staggerDelay={0.06}>
              {gigs.map((g) => (
                <Reveal key={g.id}>
                  <GigCard gig={g} />
                </Reveal>
              ))}
            </Stagger>
          )}
        </Reveal>
      </div>
    </div>
  )
}
