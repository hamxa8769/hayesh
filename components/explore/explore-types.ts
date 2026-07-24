/**
 * Unified shape for the /explore marketplace browser. Teachers, gigs, and AI
 * services are mapped into this single type so ExploreBrowser/ServiceCard/
 * ServiceRow never need to branch on the original DB row shape.
 */
export type ServiceKind = "teacher" | "gig" | "ai"

export interface ServiceItem {
  id: string
  kind: ServiceKind
  /** Human label for the kind badge, e.g. "Teacher" / "Gig" / "AI Service". */
  badge: string
  title: string
  subtitle: string
  /** Raw category used for the category filter (subject for teachers, category text for gigs/ai). */
  category: string
  priceLabel: string
  /** Numeric price used for sorting; null means "no price set" and sorts last. */
  priceValue: number | null
  rating: number | null
  /** Sort metric for "Most popular" — total_orders for gigs/ai, average_rating for teachers. */
  popularity: number
  href: string
  imageUrl: string | null
}

/** Minimal row shape actually selected from public.teachers for /explore. */
export interface ExploreTeacherRow {
  id: string
  display_name: string
  tagline: string | null
  subjects: Array<{ subject: string; level?: string }> | null
  profile_photo_url: string | null
  average_rating: number | null
  total_reviews: number | null
  group_price_pkr: number | null
  standard_price_pkr: number | null
  private_price_pkr: number | null
  featured: boolean | null
}

/** Minimal row shape actually selected from public.gigs for /explore (seller embed normalized to a single object). */
export interface ExploreGigRow {
  id: string
  title: string
  category: string
  basic_price_pkr: number | null
  standard_price_pkr: number | null
  premium_price_pkr: number | null
  basic_delivery_days: number | null
  average_rating: number | null
  total_orders: number | null
  seller_name: string | null
}

/** Safe display columns only — system_prompt is intentionally never selected or typed here. */
export interface ExploreAIServiceRow {
  id: string
  title: string
  description: string
  category: string
  thumbnail_url: string | null
  price_pkr: number | null
  output_format: string | null
  delivery_time_hrs: number | null
  average_rating: number | null
  total_orders: number | null
}

function minPositive(values: Array<number | null>): number | null {
  const defined = values.filter((v): v is number => v != null)
  if (defined.length === 0) return null
  return Math.min(...defined)
}

export function teacherToItem(teacher: ExploreTeacherRow): ServiceItem {
  const subjects = teacher.subjects || []
  const primarySubject = subjects[0]?.subject || "Teaching"
  const min = minPositive([teacher.group_price_pkr, teacher.standard_price_pkr, teacher.private_price_pkr])

  return {
    id: teacher.id,
    kind: "teacher",
    badge: "Teacher",
    title: teacher.display_name,
    subtitle: teacher.tagline || "Verified teacher",
    category: primarySubject,
    priceLabel: min != null ? `from PKR ${min.toLocaleString("en-US")}/mo` : "Contact for rate",
    priceValue: min,
    rating: teacher.average_rating,
    popularity: teacher.average_rating ?? 0,
    href: `/teachers/${teacher.id}`,
    imageUrl: teacher.profile_photo_url,
  }
}

export function gigToItem(gig: ExploreGigRow): ServiceItem {
  return {
    id: gig.id,
    kind: "gig",
    badge: "Gig",
    title: gig.title,
    subtitle: gig.seller_name ? `by ${gig.seller_name}` : "by Hayesh Seller",
    category: gig.category || "General",
    priceLabel: gig.basic_price_pkr != null ? `from PKR ${gig.basic_price_pkr.toLocaleString("en-US")}` : "Contact for price",
    priceValue: gig.basic_price_pkr,
    rating: gig.average_rating,
    popularity: gig.total_orders ?? 0,
    href: `/marketplace/${gig.id}`,
    imageUrl: null,
  }
}

export function aiServiceToItem(service: ExploreAIServiceRow): ServiceItem {
  const price = service.price_pkr
  return {
    id: service.id,
    kind: "ai",
    badge: "AI Service",
    title: service.title,
    subtitle: service.description,
    category: service.category || "General",
    priceLabel: price == null || price === 0 ? "Free" : `PKR ${price.toLocaleString("en-US")}`,
    priceValue: price ?? 0,
    rating: service.average_rating,
    popularity: service.total_orders ?? 0,
    href: `/ai-services/${service.id}`,
    imageUrl: service.thumbnail_url,
  }
}
