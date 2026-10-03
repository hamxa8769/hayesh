import { experienceYearsFrom, lessonTypesFromPrices } from "@/components/cards/TeacherCard"
/**
 * Shared data model for the /explore marketplace home. Pure (no React, no
 * browser APIs) so the server page can map rows and the client can filter,
 * sort and group the same serialisable items.
 */

export type ExploreKind = "teacher" | "gig" | "ai"
export type ExploreTypeFilter = "all" | ExploreKind
export type ExploreSort = "recommended" | "top_rated" | "popular" | "price_asc" | "price_desc" | "newest"

export const TUTORING_CATEGORY = "Tutoring"
export const AI_CATEGORY = "HayeshAI Studio"

interface BaseItem {
  key: string
  id: string
  title: string
  blurb: string
  owner: string
  category: string
  /** Lowest price in PKR (teachers: per month). */
  price: number | null
  rating: number | null
  popularity: number
  featured: boolean
  createdAt: number
  haystack: string
}

export interface TeacherItem extends BaseItem {
  kind: "teacher"
  photoUrl: string | null
  subjects: string[]
  totalReviews: number
  totalStudents: number
  translationEnabled: boolean
  lessonTypes: string[]
  experienceYears: number | null
}

export interface GigItem extends BaseItem {
  kind: "gig"
  coverUrl: string | null
  sellerName: string | null
  sellerAvatar: string | null
  sellerLevel: "new" | "rising" | "top" | "elite" | null
  deliveryDays: number | null
  orders: number
  reviewCount: number
  packageCount: number
}

export interface AiItem extends BaseItem {
  kind: "ai"
  thumbnailUrl: string | null
  deliveryHrs: number | null
  orders: number
}

export type ExploreItem = TeacherItem | GigItem | AiItem

export interface ExploreViewer {
  firstName: string | null
  role: "admin" | "teacher" | "parent" | "seller" | "buyer" | null
}

/* ----------------------------- raw row shapes ----------------------------- */

export interface TeacherRow {
  id: string
  display_name: string
  tagline: string | null
  subjects: Array<{ subject: string; level?: string | null }> | null
  experience: unknown
  profile_photo_url: string | null
  average_rating: number | null
  total_reviews: number | null
  total_students: number | null
  group_price_pkr: number | null
  standard_price_pkr: number | null
  private_price_pkr: number | null
  translation_enabled: boolean | null
  featured: boolean | null
  featured_until: string | null
  created_at: string | null
}

export interface SellerEmbed {
  display_name: string | null
  avatar_url: string | null
  level: "new" | "rising" | "top" | "elite" | null
}

export interface GigRow {
  id: string
  title: string
  category: string
  gallery_urls: string[] | null
  basic_price_pkr: number | null
  standard_price_pkr: number | null
  premium_price_pkr: number | null
  basic_delivery_days: number | null
  average_rating: number | null
  total_orders: number | null
  total_reviews: number | null
  is_featured: boolean | null
  featured_until: string | null
  created_at: string | null
  sellers: SellerEmbed | SellerEmbed[] | null
}

export interface AiServiceRow {
  id: string
  title: string
  description: string | null
  category: string | null
  thumbnail_url: string | null
  price_pkr: number | null
  revisions_allowed: number | null
  delivery_time_hrs: number | null
  average_rating: number | null
  total_orders: number | null
  created_at: string | null
}

/* -------------------------------- mappers --------------------------------- */

function lowest(...values: Array<number | null | undefined>): number | null {
  const valid = values.filter((v): v is number => typeof v === "number" && v > 0)
  return valid.length > 0 ? Math.min(...valid) : null
}

function isFeatured(flag: boolean | null, until: string | null, now: number): boolean {
  if (!flag) return false
  if (!until) return true
  const t = new Date(until).getTime()
  return Number.isNaN(t) ? true : t > now
}

/** Gig categories are free text; normalise casing so tiles and filters group cleanly. */
function titleCase(value: string): string {
  return value.trim().replace(/\b([a-z])/g, (c) => c.toUpperCase())
}

function toTime(value: string | null): number {
  if (!value) return 0
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? 0 : t
}

function hay(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" ").toLowerCase()
}

export function teacherToItem(row: TeacherRow, now: number): TeacherItem {
  const entries = row.subjects ?? []
  return {
    key: `teacher:${row.id}`,
    id: row.id,
    kind: "teacher",
    title: row.display_name,
    blurb: row.tagline ?? "",
    owner: row.display_name,
    category: TUTORING_CATEGORY,
    price: lowest(row.group_price_pkr, row.standard_price_pkr, row.private_price_pkr),
    rating: row.average_rating,
    popularity: row.total_students ?? 0,
    featured: isFeatured(row.featured, row.featured_until, now),
    createdAt: toTime(row.created_at),
    haystack: hay([
      row.display_name,
      row.tagline,
      TUTORING_CATEGORY,
      "tutor teacher lessons",
      ...entries.flatMap((e) => [e.subject, e.level]),
    ]),
    photoUrl: row.profile_photo_url,
    subjects: entries.map((e) => e.subject),
    totalReviews: row.total_reviews ?? 0,
    totalStudents: row.total_students ?? 0,
    translationEnabled: Boolean(row.translation_enabled),
    lessonTypes: lessonTypesFromPrices(row.private_price_pkr, row.standard_price_pkr, row.group_price_pkr),
    experienceYears: experienceYearsFrom(row.experience),
  }
}

export function gigToItem(row: GigRow, now: number): GigItem {
  const seller = Array.isArray(row.sellers) ? (row.sellers[0] ?? null) : row.sellers
  return {
    key: `gig:${row.id}`,
    id: row.id,
    kind: "gig",
    title: row.title,
    blurb: "",
    owner: seller?.display_name ?? "",
    category: titleCase(row.category),
    price: lowest(row.basic_price_pkr, row.standard_price_pkr, row.premium_price_pkr),
    rating: row.average_rating,
    popularity: row.total_orders ?? 0,
    featured: isFeatured(row.is_featured, row.featured_until, now),
    createdAt: toTime(row.created_at),
    haystack: hay([row.title, titleCase(row.category), seller?.display_name, "service gig freelance"]),
    coverUrl: row.gallery_urls?.[0] ?? null,
    sellerName: seller?.display_name ?? null,
    sellerAvatar: seller?.avatar_url ?? null,
    sellerLevel: seller?.level ?? null,
    deliveryDays: row.basic_delivery_days,
    orders: row.total_orders ?? 0,
    reviewCount: row.total_reviews ?? 0,
    packageCount: [row.basic_price_pkr, row.standard_price_pkr, row.premium_price_pkr].filter((p) => typeof p === "number" && p > 0).length,
  }
}

export function aiToItem(row: AiServiceRow): AiItem {
  return {
    key: `ai:${row.id}`,
    id: row.id,
    kind: "ai",
    title: row.title,
    blurb: row.description ?? "",
    owner: "HayeshAI Studio",
    category: AI_CATEGORY,
    price: lowest(row.price_pkr),
    rating: row.average_rating,
    popularity: row.total_orders ?? 0,
    featured: false,
    createdAt: toTime(row.created_at),
    haystack: hay([row.title, row.description, row.category, AI_CATEGORY, "ai instant automated"]),
    thumbnailUrl: row.thumbnail_url,
    deliveryHrs: row.delivery_time_hrs,
    orders: row.total_orders ?? 0,
  }
}

/* ------------------------------ URL params -------------------------------- */

export interface ExploreParams {
  q: string
  type: ExploreTypeFilter
  category: string
  min: number | null
  max: number | null
  rating: number
  sort: ExploreSort
}

export const DEFAULT_PARAMS: ExploreParams = {
  q: "",
  type: "all",
  category: "",
  min: null,
  max: null,
  rating: 0,
  sort: "recommended",
}

const SORTS: ExploreSort[] = ["recommended", "top_rated", "popular", "price_asc", "price_desc", "newest"]
const TYPES: ExploreTypeFilter[] = ["all", "teacher", "gig", "ai"]

function parseNumber(value: string | null): number | null {
  if (value == null || value.trim() === "") return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function parseParams(sp: { get(name: string): string | null }): ExploreParams {
  const type = sp.get("type") as ExploreTypeFilter | null
  const sort = sp.get("sort") as ExploreSort | null
  const rating = parseNumber(sp.get("rating")) ?? 0
  return {
    q: (sp.get("q") ?? "").slice(0, 120),
    type: type && TYPES.includes(type) ? type : "all",
    category: sp.get("category") ?? "",
    min: parseNumber(sp.get("min")),
    max: parseNumber(sp.get("max")),
    rating: rating >= 4.5 ? 4.5 : rating >= 4 ? 4 : 0,
    sort: sort && SORTS.includes(sort) ? sort : "recommended",
  }
}

export function serializeParams(p: ExploreParams): string {
  const sp = new URLSearchParams()
  if (p.q.trim()) sp.set("q", p.q.trim())
  if (p.type !== "all") sp.set("type", p.type)
  if (p.category) sp.set("category", p.category)
  if (p.min != null) sp.set("min", String(p.min))
  if (p.max != null) sp.set("max", String(p.max))
  if (p.rating > 0) sp.set("rating", String(p.rating))
  if (p.sort !== "recommended") sp.set("sort", p.sort)
  const s = sp.toString()
  return s ? `?${s}` : ""
}

/** Results mode = anything beyond the plain curated home is in the URL. */
export function isResultsMode(p: ExploreParams): boolean {
  return (
    p.q.trim() !== "" ||
    p.type !== "all" ||
    p.category !== "" ||
    p.min != null ||
    p.max != null ||
    p.rating > 0 ||
    p.sort !== "recommended"
  )
}

/* ----------------------------- filter and sort ---------------------------- */

export function matchesQuery(item: ExploreItem, q: string): boolean {
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean)
  return tokens.every((t) => item.haystack.includes(t))
}

function recommendedScore(item: ExploreItem): number {
  return (item.featured ? 1000 : 0) + (item.rating ?? 0) * 40 + Math.log10(item.popularity + 1) * 25
}

const compareBy: Record<ExploreSort, (a: ExploreItem, b: ExploreItem) => number> = {
  recommended: (a, b) => recommendedScore(b) - recommendedScore(a),
  top_rated: (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.popularity - a.popularity,
  popular: (a, b) => b.popularity - a.popularity || (b.rating ?? 0) - (a.rating ?? 0),
  price_asc: (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity),
  price_desc: (a, b) => (b.price ?? -1) - (a.price ?? -1),
  newest: (a, b) => b.createdAt - a.createdAt,
}

export function sortItems(items: ExploreItem[], sort: ExploreSort): ExploreItem[] {
  return [...items].sort(compareBy[sort])
}

export function filterItems(items: ExploreItem[], p: ExploreParams): ExploreItem[] {
  const filtered = items.filter((item) => {
    if (p.type !== "all" && item.kind !== p.type) return false
    if (p.category && item.category !== p.category) return false
    if (p.q.trim() && !matchesQuery(item, p.q)) return false
    if (p.min != null && (item.price == null || item.price < p.min)) return false
    if (p.max != null && (item.price == null || item.price > p.max)) return false
    if (p.rating > 0 && (item.rating ?? 0) < p.rating) return false
    return true
  })
  return sortItems(filtered, p.sort)
}

export interface CategoryCount {
  label: string
  count: number
}

const CATEGORY_ORDER = ["Tutoring", "Design", "Programming", "Writing", "Video", "Marketing"]

export function categoryCounts(items: ExploreItem[]): CategoryCount[] {
  const map = new Map<string, number>()
  for (const item of items) map.set(item.category, (map.get(item.category) ?? 0) + 1)
  const rank = (label: string): number => {
    if (label === AI_CATEGORY) return 1000
    const i = CATEGORY_ORDER.findIndex((c) => c.toLowerCase() === label.toLowerCase())
    return i === -1 ? 500 : i
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => rank(a.label) - rank(b.label) || b.count - a.count)
}
