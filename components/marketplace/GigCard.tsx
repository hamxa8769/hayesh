"use client"

import Link from "next/link"
import { ImageIcon, Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatPKR } from "@/lib/utils/format"
import type { Gig } from "@/types/database"

export interface GigCardProps {
  gig: Gig
}

/**
 * Reusable card for a single gig — thumbnail, category eyebrow, title,
 * rating/orders, and starting price. Whole card links to the gig detail page.
 * Used on the marketplace listing and on seller public profiles.
 */
export function GigCard({ gig }: GigCardProps) {
  const thumbnail = gig.gallery_urls && gig.gallery_urls.length > 0 ? gig.gallery_urls[0] : null

  return (
    <Link href={`/marketplace/${gig.id}`} className="group block h-full">
      <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface transition-all duration-150 hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface-elevated hover:shadow-[0_12px_30px_rgba(0,0,0,0.45),0_0_24px_rgba(39,196,160,0.1)]">
        <div className="aspect-video w-full shrink-0 overflow-hidden border-b border-border bg-surface-elevated">
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnail} alt={gig.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageIcon className="h-8 w-8 text-text-disabled" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-center justify-between gap-3">
            <Badge variant="secondary" className="uppercase tracking-[0.06em]">
              {gig.category}
            </Badge>
            {gig.average_rating != null && (
              <span className="inline-flex items-center gap-1 font-mono text-xs tabular-nums text-text-muted">
                <Star className="h-3 w-3 fill-accent-secondary text-accent-secondary" />
                {gig.average_rating.toFixed(1)}
                {gig.total_orders != null && <span className="text-text-disabled">({gig.total_orders})</span>}
              </span>
            )}
          </div>

          <h3 className="mt-3 line-clamp-2 flex-1 font-display text-base font-semibold leading-snug text-text-primary">
            {gig.title}
          </h3>

          <div className="mt-4 flex items-end justify-between border-t border-border pt-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-disabled">From</span>
            <span className="font-mono text-lg font-semibold tabular-nums text-accent-primary">
              {formatPKR(gig.basic_price_pkr || 0)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
