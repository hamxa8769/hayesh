import Link from "next/link"
import { BadgeCheck, Clock, Layers, Star } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { formatCurrency } from "@/lib/utils/format"
import { CardCover } from "./CardCover"
import { CARD_LINK_CLASS, CARD_SURFACE_CLASS, getInitials } from "./card-utils"

export interface GigCardSeller {
  display_name: string | null
  avatar_url: string | null
  level: "new" | "rising" | "top" | "elite" | null
}

export interface GigCardProps {
  id: string
  title: string
  category: string
  coverUrl: string | null
  seller: GigCardSeller | null
  rating: number | null
  /** Review count or order count shown next to the rating. */
  count: number | null
  countLabel?: string
  startingPrice: number | null
  currency?: "PKR" | "USD"
  deliveryDays: number | null
  /** Number of published reviews (shown as "(12)" next to the rating). */
  reviewCount?: number | null
  /** How many packages (Basic/Standard/Premium) are offered. */
  packageCount?: number | null
  featured?: boolean
  className?: string
}

const LEVEL_LABEL: Record<NonNullable<GigCardSeller["level"]>, string> = {
  new: "New",
  rising: "Rising",
  top: "Top rated",
  elite: "Elite",
}

export function minPrice(...prices: Array<number | null | undefined>): number | null {
  const valid = prices.filter((p): p is number => typeof p === "number" && p > 0)
  return valid.length > 0 ? Math.min(...valid) : null
}

export function GigCard({
  id,
  title,
  category,
  coverUrl,
  seller,
  rating,
  count,
  countLabel = "orders",
  startingPrice,
  currency = "PKR",
  deliveryDays,
  reviewCount,
  packageCount,
  featured = false,
  className,
}: GigCardProps) {
  const sellerName = seller?.display_name || "Hayesh Seller"
  const hasRating = rating != null && rating > 0
  const showLevel = seller?.level && seller.level !== "new"

  return (
    <Link href={`/marketplace/${id}`} className={cn(CARD_LINK_CLASS, className)}>
      <article className={CARD_SURFACE_CLASS}>
        <CardCover category={category} imageUrl={coverUrl} alt={title}>
          <span className="absolute left-2 top-2 max-w-[70%] truncate rounded-full border border-line-strong bg-background/80 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-text-muted backdrop-blur sm:left-3 sm:top-3 sm:px-2.5 sm:text-[10px]">
            {category}
          </span>
          {featured && (
            <span className="absolute right-2 top-2 rounded-full bg-accent-secondary px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-background sm:right-3 sm:top-3 sm:px-2.5 sm:text-[10px]">
              Featured
            </span>
          )}
        </CardCover>

        <div className="flex flex-1 flex-col gap-2 p-3 sm:gap-3 sm:p-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            {seller?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={seller.avatar_url} alt="" loading="lazy" className="h-6 w-6 shrink-0 rounded-full border border-border object-cover sm:h-7 sm:w-7" />
            ) : (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface-elevated font-mono text-[9px] font-semibold text-text-muted sm:h-7 sm:w-7 sm:text-[10px]">
                {getInitials(sellerName)}
              </span>
            )}
            <span className="min-w-0 truncate text-xs text-text-primary sm:text-sm">{sellerName}</span>
            {showLevel && seller?.level && (
              <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-accent-primary" title={LEVEL_LABEL[seller.level]}>
                <BadgeCheck className="h-3 w-3" aria-label={LEVEL_LABEL[seller.level]} />
                <span className="hidden sm:inline">{LEVEL_LABEL[seller.level]}</span>
              </span>
            )}
          </div>

          <h3 className="line-clamp-2 min-h-[2.5rem] font-display text-[13px] font-semibold leading-snug text-text-primary sm:min-h-[2.75rem] sm:text-base">
            {title}
          </h3>

          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] sm:text-xs">
            {hasRating ? (
              <>
                <Star className="h-3.5 w-3.5 fill-accent-secondary text-accent-secondary" aria-hidden="true" />
                <span className="font-mono font-semibold tabular-nums text-text-primary">{rating.toFixed(1)}</span>
                {reviewCount != null && reviewCount > 0 && (
                  <span className="font-mono tabular-nums text-text-muted">({reviewCount})</span>
                )}
              </>
            ) : (
              <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
                New
              </span>
            )}
            {count != null && count > 0 && (
              <span className="hidden font-mono tabular-nums text-text-muted sm:inline">
                &middot; {count} {countLabel}
              </span>
            )}
            {packageCount != null && packageCount > 1 && (
              <span className="ml-auto hidden items-center gap-1 text-text-muted sm:inline-flex">
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                {packageCount} packages
              </span>
            )}
          </div>

          <div className="mt-auto flex items-end justify-between gap-2 border-t border-border pt-2 sm:gap-3 sm:pt-3">
            <div className="flex flex-col">
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-muted sm:text-[10px]">Starting at</span>
              <span className="font-mono text-sm font-semibold tabular-nums text-text-primary sm:text-base">
                {startingPrice != null ? formatCurrency(startingPrice, currency) : "—"}
              </span>
            </div>
            {deliveryDays != null && deliveryDays > 0 && (
              <span className="inline-flex items-center gap-1 pb-0.5 text-[11px] text-text-muted sm:text-xs">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sm:hidden">{`${deliveryDays}d`}</span>
                <span className="hidden sm:inline">{`${deliveryDays}-day delivery`}</span>
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  )
}

export function GigCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface" aria-hidden="true">
      <div className="aspect-[16/10] w-full animate-pulse bg-surface-elevated" />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 animate-pulse rounded-full bg-surface-elevated" />
          <div className="h-3 w-24 animate-pulse rounded bg-surface-elevated" />
        </div>
        <div className="h-11 animate-pulse rounded bg-surface-elevated" />
        <div className="h-3 w-28 animate-pulse rounded bg-surface-elevated" />
        <div className="mt-1 border-t border-border pt-3">
          <div className="h-8 w-32 animate-pulse rounded bg-surface-elevated" />
        </div>
      </div>
    </div>
  )
}
