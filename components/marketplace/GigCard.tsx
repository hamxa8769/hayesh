import { GigCard as SharedGigCard, minPrice, type GigCardSeller } from "@/components/cards/GigCard"
import type { Gig } from "@/types/database"

export interface GigCardProps {
  gig: Gig
  seller?: GigCardSeller | null
  featured?: boolean
  className?: string
}

function isGigFeatured(gig: Gig): boolean {
  return Boolean(gig.is_featured) && (!gig.featured_until || new Date(gig.featured_until).getTime() > Date.now())
}

/** Adapter from a full `gigs` row to the shared marketplace card. */
export function GigCard({ gig, seller = null, featured, className }: GigCardProps) {
  return (
    <SharedGigCard
      id={gig.id}
      title={gig.title}
      category={gig.category}
      coverUrl={gig.gallery_urls && gig.gallery_urls.length > 0 ? gig.gallery_urls[0] : null}
      seller={seller}
      rating={gig.average_rating}
      count={gig.total_orders}
      startingPrice={minPrice(gig.basic_price_pkr, gig.standard_price_pkr, gig.premium_price_pkr)}
      deliveryDays={gig.basic_delivery_days}
      reviewCount={gig.total_reviews}
      packageCount={[gig.basic_price_pkr, gig.standard_price_pkr, gig.premium_price_pkr].filter((p) => typeof p === "number" && p > 0).length}
      featured={featured ?? isGigFeatured(gig)}
      className={className}
    />
  )
}
