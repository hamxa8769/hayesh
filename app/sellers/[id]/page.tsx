import { cache } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { BackButton } from "@/components/navigation/BackButton"
import { createClient } from "@/lib/supabase/server"
import { Section } from "@/components/gig-detail/section"
import { GigCardGrid, type GigWithSeller } from "@/components/gig-detail/gig-card-grid"
import type { DetailSeller } from "@/components/gig-detail/gig-data"
import { SellerHeader } from "@/components/seller-profile/seller-header"
import { SellerStats } from "@/components/seller-profile/seller-stats"
import { SellerReviews, type SellerReviewItem } from "@/components/seller-profile/seller-reviews"
import { PortfolioLinks } from "@/components/seller-profile/portfolio-links"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SELLER_COLUMNS =
  "id, user_id, display_name, tagline, avatar_url, level, is_online, last_seen_at, average_rating, total_reviews, response_time_hrs, completed_orders, total_orders, skills, languages, portfolio_urls, created_at"

type ProfileSeller = DetailSeller & { portfolio_urls: string[] | null }

const loadSeller = cache(async (id: string): Promise<ProfileSeller | null> => {
  if (!UUID_RE.test(id)) return null
  const supabase = await createClient()
  const { data } = await supabase.from("sellers").select(SELLER_COLUMNS).eq("id", id).eq("status", "approved").maybeSingle()
  return (data as ProfileSeller | null) ?? null
})

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const seller = await loadSeller(id)
  if (!seller) return { title: "Seller not found" }
  const description = seller.tagline || `${seller.display_name} on Hayesh — services, reviews and portfolio.`
  return {
    title: seller.display_name,
    description,
    openGraph: { title: seller.display_name, description, type: "profile", ...(seller.avatar_url ? { images: [{ url: seller.avatar_url }] } : {}) },
  }
}

export default async function SellerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const seller = await loadSeller(id)
  if (!seller) notFound()

  const supabase = await createClient()
  const [gigsRes, reviewsRes] = await Promise.all([
    supabase
      .from("gigs")
      .select("*, sellers(display_name, avatar_url, level)")
      .eq("seller_id", seller.id)
      .eq("status", "approved")
      .order("created_at", { ascending: false }),
    supabase
      .from("gig_reviews")
      .select("id, gig_id, reviewer_name, rating, comment, created_at")
      .eq("seller_id", seller.id)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(6),
  ])

  const gigs = (gigsRes.data ?? []) as unknown as GigWithSeller[]

  // The reviews table may not exist on older databases — skip the block quietly.
  let reviews: SellerReviewItem[] = []
  if (!reviewsRes.error && reviewsRes.data && reviewsRes.data.length > 0) {
    const rows = reviewsRes.data as Array<Omit<SellerReviewItem, "gig_title">>
    const gigIds = Array.from(new Set(rows.map((r) => r.gig_id)))
    const { data: titleRows } = await supabase.from("gigs").select("id, title").in("id", gigIds)
    const titles = new Map(((titleRows ?? []) as Array<{ id: string; title: string }>).map((g) => [g.id, g.title]))
    reviews = rows.map((r) => ({ ...r, gig_title: titles.get(r.gig_id) ?? null }))
  }

  const skills = seller.skills ?? []
  const languages = seller.languages ?? []
  const portfolio = seller.portfolio_urls ?? []
  const rating = seller.average_rating ?? 0

  const stats = [
    { label: "Orders completed", value: (seller.completed_orders ?? 0).toLocaleString("en-US") },
    { label: "Rating", value: rating > 0 ? rating.toFixed(1) : "—" },
    { label: "Reviews", value: (seller.total_reviews ?? 0).toLocaleString("en-US") },
    { label: "Response time", value: seller.response_time_hrs ? `${seller.response_time_hrs}h` : "—" },
  ]

  return (
    <div className="pb-16 pt-6">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-4 sm:px-6">
        <BackButton fallbackHref="/marketplace" label="Back" className="self-start" />

        <div className="flex flex-col gap-4">
          <SellerHeader seller={seller} inquiryGigId={gigs[0]?.id ?? null} />
          <SellerStats stats={stats} />
        </div>

        {(skills.length > 0 || languages.length > 0) && (
          <div className="grid gap-8 rounded-lg border border-border bg-surface p-5 sm:grid-cols-2 sm:p-6">
            {skills.length > 0 && (
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Skills</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {skills.map((s) => (
                    <li key={s} className="rounded-full border border-border bg-surface-elevated px-3 py-1 text-sm text-text-primary">{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {languages.length > 0 && (
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Languages</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {languages.map((l) => (
                    <li key={l} className="rounded-full border border-border px-3 py-1 text-sm text-text-muted">{l}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <Section eyebrow="Services" title={`Services by ${seller.display_name}`}>
          {gigs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line-strong bg-surface px-6 py-14 text-center text-sm text-text-muted">
              No active services yet.
            </div>
          ) : (
            <GigCardGrid gigs={gigs} columns={4} />
          )}
        </Section>

        {reviews.length > 0 && (
          <Section eyebrow="Feedback" title="Recent reviews">
            <SellerReviews reviews={reviews} />
          </Section>
        )}

        {portfolio.length > 0 && (
          <Section eyebrow="Work" title="Portfolio">
            <PortfolioLinks urls={portfolio} name={seller.display_name} />
          </Section>
        )}
      </div>
    </div>
  )
}
