import { BadgeCheck, CalendarDays, Clock, Star } from "lucide-react"
import { SellerAvatar } from "@/components/gig-detail/seller-avatar"
import { MessageSellerButton } from "@/components/gig-detail/message-seller-button"
import { LEVEL_LABELS, memberSince, responseTimeLabel, type DetailSeller } from "@/components/gig-detail/gig-data"

interface SellerHeaderProps {
  seller: DetailSeller
  /** First approved gig id — the inquiry is attached to it. Null hides the button. */
  inquiryGigId: string | null
}

export function SellerHeader({ seller, inquiryGigId }: SellerHeaderProps) {
  const since = memberSince(seller.created_at)
  const response = responseTimeLabel(seller.response_time_hrs)
  const rating = seller.average_rating ?? 0

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-surface">
      <div className="h-24 w-full border-b border-border sm:h-28" aria-hidden="true" style={{
        backgroundImage: [
          "radial-gradient(90% 140% at 10% 0%, color-mix(in srgb, var(--color-accent-primary) 24%, transparent), transparent 60%)",
          "radial-gradient(70% 140% at 95% 100%, color-mix(in srgb, var(--color-accent-secondary) 18%, transparent), transparent 60%)",
          "linear-gradient(var(--color-border) 1px, transparent 1px)",
          "linear-gradient(90deg, var(--color-border) 1px, transparent 1px)",
        ].join(", "),
        backgroundSize: "auto, auto, 28px 28px, 28px 28px",
      }} />
      <div className="flex flex-col gap-5 px-5 pb-6 sm:flex-row sm:items-end sm:justify-between sm:px-8">
        <div className="-mt-12 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
          <span className="rounded-full border-4 border-surface bg-surface">
            <SellerAvatar name={seller.display_name} url={seller.avatar_url} online={seller.is_online} className="h-24 w-24" textClassName="text-2xl" />
          </span>
          <div className="min-w-0 sm:pb-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-balance font-display text-3xl font-semibold tracking-tight text-text-primary">{seller.display_name}</h1>
              {seller.level && seller.level !== "new" && (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-primary">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  {LEVEL_LABELS[seller.level]}
                </span>
              )}
              {seller.is_online && (
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-success" aria-hidden="true" /> Online now
                </span>
              )}
            </div>
            <p className="mt-1 max-w-xl text-sm text-text-muted">{seller.tagline || "Freelance seller on Hayesh"}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-text-muted">
              {rating > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-accent-warning text-accent-warning" aria-hidden="true" />
                  <span className="font-mono font-semibold tabular-nums text-text-primary">{rating.toFixed(1)}</span>
                  <span className="font-mono tabular-nums">({seller.total_reviews ?? 0})</span>
                </span>
              ) : (
                // "No reviews yet", not "New seller": a top-rated level can
                // coexist with zero reviews, and the two labels contradicted.
                <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]">No reviews yet</span>
              )}
              {since && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" /> Member since {since}
                </span>
              )}
              {response && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" aria-hidden="true" /> {response}
                </span>
              )}
            </div>
          </div>
        </div>
        {inquiryGigId && (
          <div className="w-full shrink-0 sm:w-48">
            <MessageSellerButton gigId={inquiryGigId} redirectPath={`/sellers/${seller.id}`} variant="aurora" size="lg" />
          </div>
        )}
      </div>
    </div>
  )
}
