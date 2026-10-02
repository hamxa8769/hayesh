import Link from "next/link"
import { Clock, Sparkles, Star, Zap } from "lucide-react"
import { CardCover } from "@/components/cards/CardCover"
import { CARD_LINK_CLASS, CARD_SURFACE_CLASS } from "@/components/cards/card-utils"
import { cn } from "@/lib/utils/cn"
import { formatPKR } from "@/lib/utils/format"

export interface AIServiceCardProps {
  id: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  rating: number | null
  orders: number | null
  price: number | null
  deliveryHrs: number | null
  className?: string
}

function formatDelivery(hours: number): string {
  if (hours < 1) return "Under 1 hr"
  if (hours < 24) return `~${Math.round(hours)} hr`
  return `~${Math.round(hours / 24)} day`
}

/** "HayeshAI Studio" listing card — same visual language as GigCard. */
export function AIServiceCard({
  id,
  title,
  description,
  thumbnailUrl,
  rating,
  orders,
  price,
  deliveryHrs,
  className,
}: AIServiceCardProps) {
  const hasRating = rating != null && rating > 0

  return (
    <Link href={`/ai-services/${id}`} className={cn(CARD_LINK_CLASS, className)}>
      <article className={CARD_SURFACE_CLASS}>
        <CardCover category="AI" imageUrl={thumbnailUrl} alt={title} icon={Sparkles}>
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-line-strong bg-background/80 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted backdrop-blur">
            <Sparkles className="h-3 w-3 text-accent-secondary" aria-hidden="true" />
            HayeshAI
          </span>
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-accent-success/40 bg-accent-success/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-success backdrop-blur">
            <Zap className="h-3 w-3" aria-hidden="true" />
            Instant
          </span>
        </CardCover>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <h3 className="line-clamp-2 min-h-[2.75rem] font-display text-base font-semibold leading-snug text-text-primary">
            {title}
          </h3>
          <p className="line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-text-muted">
            {description || "Delivered automatically by HayeshAI."}
          </p>

          <div className="flex items-center gap-1.5 text-xs">
            {hasRating ? (
              <>
                <Star className="h-3.5 w-3.5 fill-accent-secondary text-accent-secondary" aria-hidden="true" />
                <span className="font-mono font-semibold tabular-nums text-text-primary">{rating.toFixed(1)}</span>
                {orders != null && orders > 0 && (
                  <span className="font-mono tabular-nums text-text-muted">&middot; {orders} orders</span>
                )}
              </>
            ) : (
              <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
                New
              </span>
            )}
          </div>

          <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-3">
            <div className="flex flex-col">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">From</span>
              <span className="font-mono text-base font-semibold tabular-nums text-text-primary">
                {price != null ? formatPKR(price) : "—"}
              </span>
            </div>
            {deliveryHrs != null && deliveryHrs > 0 && (
              <span className="inline-flex items-center gap-1 pb-0.5 text-xs text-text-muted">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {formatDelivery(deliveryHrs)}
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  )
}

export function AIServiceCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface" aria-hidden="true">
      <div className="aspect-[16/10] w-full animate-pulse bg-surface-elevated" />
      <div className="flex flex-col gap-3 p-4">
        <div className="h-11 animate-pulse rounded bg-surface-elevated" />
        <div className="h-10 animate-pulse rounded bg-surface-elevated" />
        <div className="mt-1 border-t border-border pt-3">
          <div className="h-8 w-24 animate-pulse rounded bg-surface-elevated" />
        </div>
      </div>
    </div>
  )
}
