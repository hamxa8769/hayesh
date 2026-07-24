"use client"

import { Suspense, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Navbar } from "@/components/layout/Navbar"
import { ExploreBrowser } from "@/components/explore/ExploreBrowser"
import {
  aiServiceToItem,
  gigToItem,
  teacherToItem,
  type ExploreAIServiceRow,
  type ExploreGigRow,
  type ExploreTeacherRow,
  type ServiceItem,
} from "@/components/explore/explore-types"

/**
 * /explore — the unified marketplace browse surface.
 *
 * Public layout (Navbar, no dashboard sidebar) so a signed-in user gets a
 * Fiverr-style catalogue of everything Hayesh sells: approved teachers,
 * approved seller gigs, and active AI services, in one filterable list.
 */

/**
 * A Supabase many-to-one embed returns a single object at runtime, but
 * supabase-js widens the generated type to an array. Normalise defensively —
 * asserting one shape silently renders a blank seller name if the other arrives.
 */
type EmbeddedSeller = { display_name: string | null } | { display_name: string | null }[] | null

function sellerName(value: EmbeddedSeller): string | null {
  if (!value) return null
  const row = Array.isArray(value) ? value[0] : value
  return row?.display_name ?? null
}

function ExploreContent() {
  const [items, setItems] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()

        const [teacherRes, gigRes, aiRes] = await Promise.all([
          supabase
            .from("teachers")
            .select(
              "id, display_name, tagline, subjects, profile_photo_url, average_rating, total_reviews, group_price_pkr, standard_price_pkr, private_price_pkr, featured",
            )
            .eq("status", "approved"),
          supabase
            .from("gigs")
            .select(
              "id, title, category, basic_price_pkr, standard_price_pkr, premium_price_pkr, basic_delivery_days, average_rating, total_orders, sellers(display_name)",
            )
            .eq("status", "approved"),
          // system_prompt is deliberately NOT selected — migration 013 revokes it
          // from clients, and selecting it throws "permission denied".
          supabase
            .from("ai_services")
            .select(
              "id, title, description, category, thumbnail_url, price_pkr, output_format, delivery_time_hrs, average_rating, total_orders",
            )
            .eq("status", "active"),
        ])

        if (cancelled) return

        const firstError = teacherRes.error || gigRes.error || aiRes.error
        if (firstError) {
          setError(firstError.message)
          setLoading(false)
          return
        }

        const teachers = (teacherRes.data || []) as unknown as ExploreTeacherRow[]
        const gigs = (gigRes.data || []) as unknown as Array<
          Omit<ExploreGigRow, "seller_name"> & { sellers: EmbeddedSeller }
        >
        const ai = (aiRes.data || []) as unknown as ExploreAIServiceRow[]

        setItems([
          ...teachers.map(teacherToItem),
          ...gigs.map((g) => gigToItem({ ...g, seller_name: sellerName(g.sellers) })),
          ...ai.map(aiServiceToItem),
        ])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load services.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-accent-danger/30 bg-surface p-6 text-center">
        <p className="text-sm text-accent-danger">{error}</p>
        <p className="mt-1 text-xs text-text-muted">Refresh the page to try again.</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-10 text-center">
        <h2 className="font-display text-lg font-semibold text-text-primary">Nothing listed yet</h2>
        <p className="mt-1 text-sm text-text-muted">
          Approved teachers, seller gigs and AI services will appear here as they go live.
        </p>
      </div>
    )
  }

  return <ExploreBrowser items={items} />
}

export default function ExplorePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Explore</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em] text-text-primary sm:text-4xl">
            Every service on Hayesh
          </h1>
          <p className="mt-2 max-w-xl text-sm text-text-muted">
            Tutors, freelance gigs and instant AI services — search, filter and compare in one place.
          </p>
        </header>

        {/* ExploreBrowser reads filter state from the URL via useSearchParams,
            which Next requires to sit inside a Suspense boundary. */}
        <Suspense
          fallback={
            <div className="flex min-h-[40vh] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-accent-primary" />
            </div>
          }
        >
          <ExploreContent />
        </Suspense>
      </main>
    </div>
  )
}
