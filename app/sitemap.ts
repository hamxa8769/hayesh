import type { MetadataRoute } from "next"
import { createClient } from "@supabase/supabase-js"
import { getSiteUrl } from "@/lib/utils/site-url"

export const revalidate = 3600

interface IdRow {
  id: string
  updated_at: string | null
}

async function loadIds(table: "teachers" | "gigs" | "ai_services", statusValue: string): Promise<IdRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return []
  try {
    // Anon client: only rows RLS already exposes publicly end up in the sitemap.
    const supabase = createClient(url, key, { auth: { persistSession: false } })
    const { data } = await supabase.from(table).select("id, updated_at").eq("status", statusValue).limit(1000)
    return (data ?? []) as IdRow[]
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl()
  const now = new Date()
  const staticRoutes: MetadataRoute.Sitemap = ["", "/explore", "/teachers", "/marketplace", "/ai-services", "/auth/register", "/auth/login"].map(
    (path) => ({ url: `${base}${path}`, lastModified: now, changeFrequency: "daily", priority: path === "" ? 1 : 0.7 })
  )

  const [teachers, gigs, services] = await Promise.all([
    loadIds("teachers", "approved"),
    loadIds("gigs", "approved"),
    loadIds("ai_services", "active"),
  ])

  const toEntries = (rows: IdRow[], prefix: string): MetadataRoute.Sitemap =>
    rows.map((r) => ({ url: `${base}${prefix}/${r.id}`, lastModified: r.updated_at ? new Date(r.updated_at) : now, changeFrequency: "weekly", priority: 0.6 }))

  return [...staticRoutes, ...toEntries(teachers, "/teachers"), ...toEntries(gigs, "/marketplace"), ...toEntries(services, "/ai-services")]
}
