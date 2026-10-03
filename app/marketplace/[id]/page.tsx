import { cache } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { BadgeCheck, CheckCircle2, ChevronRight, Star } from "lucide-react"
import { BackButton } from "@/components/navigation/BackButton"
import { createClient } from "@/lib/supabase/server"
import { formatPKR } from "@/lib/utils/format"
import { GigGallery } from "@/components/gig-detail/gig-gallery"
import { OrderPanel } from "@/components/gig-detail/order-panel"
import { CompareTable } from "@/components/gig-detail/compare-table"
import { FaqAccordion } from "@/components/gig-detail/faq-accordion"
import { SellerCard } from "@/components/gig-detail/seller-card"
import { SellerAvatar } from "@/components/gig-detail/seller-avatar"
import { ReviewsSection } from "@/components/gig-detail/reviews-section"
import { GigCardGrid, type GigWithSeller } from "@/components/gig-detail/gig-card-grid"
import { Section } from "@/components/gig-detail/section"
import { LEVEL_LABELS, buildTiers, type DetailSeller } from "@/components/gig-detail/gig-data"
import type { Gig } from "@/types/database"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SELLER_COLUMNS =
  "id, user_id, display_name, tagline, avatar_url, level, is_online, last_seen_at, average_rating, total_reviews, response_time_hrs, completed_orders, total_orders, skills, languages, created_at"

interface GigBundle {
  gig: Gig
  seller: DetailSeller | null
}

const loadGig = cache(async (id: string): Promise<GigBundle | null> => {
  if (!UUID_RE.test(id)) return null
  const supabase = await createClient()
  const { data: gig } = await supabase.from("gigs").select("*").eq("id", id).eq("status", "approved").maybeSingle()
  if (!gig) return null
  const { data: seller } = await supabase.from("sellers").select(SELLER_COLUMNS).eq("id", (gig as Gig).seller_id).maybeSingle()
  return { gig: gig as Gig, seller: (seller as DetailSeller | null) ?? null }
})

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const bundle = await loadGig(id)
  if (!bundle) return { title: "Service not found" }
  const { gig, seller } = bundle
  const description = gig.description.replace(/\s+/g, " ").trim().slice(0, 160)
  const image = gig.gallery_urls?.[0]
  return {
    title: gig.title,
    description,
    openGraph: {
      title: gig.title,
      description,
      type: "website",
      ...(image ? { images: [{ url: image }] } : {}),
      ...(seller ? { siteName: `Hayesh · ${seller.display_name}` } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title: gig.title, description },
  }
}

export default async function GigDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const bundle = await loadGig(id)
  if (!bundle) notFound()
  const { gig, seller } = bundle

  const supabase = await createClient()
  const [moreRes, similarRes] = await Promise.all([
    supabase
      .from("gigs")
      .select("*, sellers(display_name, avatar_url, level)")
      .eq("seller_id", gig.seller_id)
      .eq("status", "approved")
      .neq("id", gig.id)
      .order("total_orders", { ascending: false })
      .limit(4),
    supabase
      .from("gigs")
      .select("*, sellers(display_name, avatar_url, level)")
      .eq("category", gig.category)
      .eq("status", "approved")
      .neq("id", gig.id)
      .order("total_orders", { ascending: false })
      .limit(12),
  ])
  const moreFromSeller = (moreRes.data ?? []) as unknown as GigWithSeller[]
  const moreIds = new Set(moreFromSeller.map((g) => g.id))
  const similarRaw = (similarRes.data ?? []) as unknown as GigWithSeller[]
  // Prefer other sellers' work; fall back to overlap only to fill the row.
  const similar = [...similarRaw.filter((g) => g.seller_id !== gig.seller_id), ...similarRaw.filter((g) => g.seller_id === gig.seller_id && !moreIds.has(g.id))]
    .slice(0, 4)

  const tiers = buildTiers(gig)
  const images = gig.gallery_urls ?? []
  const rating = gig.average_rating ?? 0
  const reviewCount = gig.total_reviews ?? 0
  const sellerName = seller?.display_name ?? "Hayesh Seller"
  const categoryLabel = gig.category.charAt(0).toUpperCase() + gig.category.slice(1)
  const startingPrice = tiers[0]?.price

  return (
    <div className="pb-28 pt-6 lg:pb-16">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-text-muted">
              <li>
                <Link href="/marketplace" className="transition-colors hover:text-text-primary">Marketplace</Link>
              </li>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-disabled" aria-hidden="true" />
              <li>
                <span>{categoryLabel}</span>
              </li>
              <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-text-disabled sm:block" aria-hidden="true" />
              <li className="hidden max-w-[28ch] truncate text-text-primary sm:block" aria-current="page">{gig.title}</li>
            </ol>
          </nav>
          <BackButton fallbackHref="/marketplace" label="Back" />
        </div>

        <div className="grid gap-x-12 gap-y-10 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Intro: title, seller row, gallery */}
          <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-1">
            <div className="flex flex-col gap-4">
              <h1 className="text-balance font-display text-3xl font-semibold leading-tight tracking-tight text-text-primary sm:text-4xl">
                {gig.title}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                {seller ? (
                  <Link href={`/sellers/${seller.id}`} className="group inline-flex items-center gap-2.5">
                    <SellerAvatar name={seller.display_name} url={seller.avatar_url} className="h-9 w-9" />
                    <span className="font-medium text-text-primary group-hover:text-accent-primary">{seller.display_name}</span>
                  </Link>
                ) : (
                  <span className="text-text-muted">{sellerName}</span>
                )}
                {seller?.level && seller.level !== "new" && (
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-primary">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    {LEVEL_LABELS[seller.level]}
                  </span>
                )}
                <span className="h-4 w-px bg-line-strong" aria-hidden="true" />
                {rating > 0 ? (
                  <a href="#reviews" className="inline-flex items-center gap-1.5 hover:text-text-primary">
                    <Star className="h-4 w-4 fill-accent-warning text-accent-warning" aria-hidden="true" />
                    <span className="font-mono font-semibold tabular-nums text-text-primary">{rating.toFixed(1)}</span>
                    <span className="font-mono tabular-nums text-text-muted">({reviewCount})</span>
                  </a>
                ) : (
                  <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">New</span>
                )}
                {(seller?.completed_orders ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-text-muted">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span className="font-mono tabular-nums">{seller?.completed_orders}</span> orders completed
                  </span>
                )}
              </div>
            </div>

            <GigGallery title={gig.title} category={gig.category} images={images} />
          </div>

          {/* Sticky order panel (inline after the gallery on mobile) */}
          <aside className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start lg:sticky lg:top-24" aria-label="Order this service">
            {tiers.length > 0 ? (
              <OrderPanel gigId={gig.id} tiers={tiers} />
            ) : (
              <div className="rounded-lg border border-border bg-surface p-6 text-sm text-text-muted">
                This service has no packages available right now.
              </div>
            )}
          </aside>

          {/* Body */}
          <div className="flex min-w-0 flex-col gap-14 lg:col-start-1 lg:row-start-2">
            <Section eyebrow="Overview" title="About this service">
              <p className="max-w-[68ch] whitespace-pre-line text-base leading-relaxed text-text-primary/90">{gig.description}</p>
              {gig.tags && gig.tags.length > 0 && (
                <ul className="mt-6 flex flex-wrap gap-2" aria-label="Tags">
                  {gig.tags.map((tag) => (
                    <li key={tag} className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-text-muted">
                      {tag}
                    </li>
                  ))}
                </ul>
              )}
              {startingPrice != null && (
                <p className="mt-6 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
                  Packages from <span className="tabular-nums text-text-primary">{formatPKR(startingPrice)}</span>
                </p>
              )}
            </Section>

            {tiers.length > 1 && (
              <Section id="compare" eyebrow="Packages" title="Compare packages">
                <CompareTable tiers={tiers} />
              </Section>
            )}

            {gig.faq && gig.faq.length > 0 && (
              <Section eyebrow="FAQ" title="Frequently asked questions">
                <FaqAccordion items={gig.faq} />
              </Section>
            )}

            {seller && (
              <Section eyebrow="Seller" title="About the seller">
                <SellerCard seller={seller} gigId={gig.id} />
              </Section>
            )}

            <ReviewsSection gigId={gig.id} sellerName={sellerName} sellerAvatar={seller?.avatar_url ?? null} />
          </div>
        </div>

        {(moreFromSeller.length > 0 || similar.length > 0) && (
          <div className="mt-16 flex flex-col gap-14 border-t border-border pt-14">
            {moreFromSeller.length > 0 && (
              <Section
                eyebrow="Seller"
                title={`More from ${sellerName}`}
                aside={
                  seller ? (
                    <Link href={`/sellers/${seller.id}`} className="shrink-0 text-sm font-medium text-text-muted transition-colors hover:text-text-primary">
                      View all
                    </Link>
                  ) : null
                }
              >
                <GigCardGrid gigs={moreFromSeller} columns={4} />
              </Section>
            )}
            {similar.length > 0 && (
              <Section eyebrow="Explore" title="You may also like">
                <GigCardGrid gigs={similar} columns={4} />
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
