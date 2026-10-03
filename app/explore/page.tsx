import type { Metadata } from "next"
import { Navbar } from "@/components/layout/Navbar"
import { ExploreExperience } from "@/components/explore/ExploreExperience"
import {
  aiToItem,
  gigToItem,
  teacherToItem,
  type AiServiceRow,
  type ExploreItem,
  type ExploreViewer,
  type GigRow,
  type TeacherRow,
} from "@/components/explore/explore-data"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Explore",
  description:
    "Find verified tutors, hire freelance experts and order instant AI services on Hayesh — with free demo lessons and escrow-protected payments.",
}

// Auth-aware greeting and RLS-scoped listings: never cache across users.
export const dynamic = "force-dynamic"

async function loadViewer(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ExploreViewer | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle()
  const profile = data as { full_name: string | null; role: ExploreViewer["role"] } | null
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || null
  return { firstName, role: profile?.role ?? null }
}

export default async function ExplorePage() {
  const supabase = await createClient()
  const now = Date.now()

  const [viewer, teacherRes, gigRes, aiRes] = await Promise.all([
    loadViewer(supabase),
    supabase
      .from("teachers")
      .select(
        "id, display_name, tagline, subjects, profile_photo_url, average_rating, total_reviews, total_students, group_price_pkr, standard_price_pkr, private_price_pkr, translation_enabled, featured, featured_until, created_at, experience",
      )
      .eq("status", "approved"),
    supabase
      .from("gigs")
      .select(
        "id, title, category, gallery_urls, basic_price_pkr, standard_price_pkr, premium_price_pkr, basic_delivery_days, average_rating, total_orders, total_reviews, is_featured, featured_until, created_at, sellers(display_name, avatar_url, level)",
      )
      .eq("status", "approved"),
    // system_prompt / ai_model are deliberately NOT selected (revoked from clients,
    // and must never reach end users).
    supabase
      .from("ai_services")
      .select(
        "id, title, description, category, thumbnail_url, price_pkr, revisions_allowed, delivery_time_hrs, average_rating, total_orders, created_at",
      )
      .eq("status", "active"),
  ])

  const items: ExploreItem[] = [
    ...((teacherRes.data ?? []) as unknown as TeacherRow[]).map((r) => teacherToItem(r, now)),
    ...((gigRes.data ?? []) as unknown as GigRow[]).map((r) => gigToItem(r, now)),
    ...((aiRes.data ?? []) as unknown as AiServiceRow[]).map(aiToItem),
  ]

  const failed = teacherRes.error || gigRes.error || aiRes.error

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-[1200px] px-4 pb-24 pt-24 sm:px-6 sm:pt-28 lg:px-8">
        {failed && items.length === 0 ? (
          <div role="alert" className="rounded-lg border border-accent-danger/30 bg-surface p-8 text-center">
            <p className="text-sm text-accent-danger">We couldn&apos;t load listings right now.</p>
            <p className="mt-1 text-xs text-text-muted">Refresh the page to try again.</p>
          </div>
        ) : (
          <ExploreExperience items={items} viewer={viewer} />
        )}
      </main>
    </div>
  )
}
