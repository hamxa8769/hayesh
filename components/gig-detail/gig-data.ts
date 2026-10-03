import type { Gig, Seller, SellerLevel } from "@/types/database"

export type TierKey = "basic" | "standard" | "premium"

export interface GigTier {
  key: TierKey
  label: string
  title: string | null
  description: string | null
  price: number
  deliveryDays: number | null
  revisions: number | null
  features: string[]
}

export const LEVEL_LABELS: Record<SellerLevel, string> = {
  new: "New Seller",
  rising: "Rising Talent",
  top: "Top Rated",
  elite: "Hayesh Elite",
}

/** Seller columns the detail pages need. */
export type DetailSeller = Pick<
  Seller,
  | "id"
  | "user_id"
  | "display_name"
  | "tagline"
  | "avatar_url"
  | "level"
  | "is_online"
  | "last_seen_at"
  | "average_rating"
  | "total_reviews"
  | "response_time_hrs"
  | "completed_orders"
  | "total_orders"
  | "skills"
  | "languages"
  | "created_at"
>

export function buildTiers(gig: Gig): GigTier[] {
  const raw: Array<Omit<GigTier, "price" | "features"> & { price: number | null; features: string[] | null }> = [
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
  return raw
    .filter((t): t is typeof t & { price: number } => typeof t.price === "number" && t.price > 0)
    .map((t) => ({ ...t, features: t.features ?? [] }))
}

export function memberSince(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
}

export function responseTimeLabel(hrs: number | null): string | null {
  if (hrs == null || hrs <= 0) return null
  if (hrs < 1) return "Usually responds within an hour"
  return `Usually responds within ${hrs}h`
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`
}
