"use client"

import Link from "next/link"
import { Bot, ShoppingBag, Star, Users, type LucideIcon } from "lucide-react"
import { CardCover } from "@/components/cards/CardCover"
import { CARD_LINK_CLASS, CARD_SURFACE_CLASS, getInitials } from "@/components/cards/card-utils"
import { cn } from "@/lib/utils/cn"
import type { ServiceItem } from "./explore-types"

const KIND_ICON: Record<ServiceItem["kind"], LucideIcon> = {
  teacher: Users,
  gig: ShoppingBag,
  ai: Bot,
}

interface ServiceCardProps {
  item: ServiceItem
  className?: string
}

export function ServiceCard({ item, className }: ServiceCardProps) {
  const KindIcon = KIND_ICON[item.kind]
  const hasRating = item.rating != null && item.rating > 0

  return (
    <Link href={item.href} className={cn(CARD_LINK_CLASS, className)}>
      <article className={CARD_SURFACE_CLASS}>
        {item.kind === "teacher" && !item.imageUrl ? (
          <div className="relative flex aspect-[16/10] w-full shrink-0 items-center justify-center border-b border-border bg-surface-elevated">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-primary/10 font-mono text-xl font-semibold text-accent-primary ring-2 ring-accent-primary/40 ring-offset-2 ring-offset-surface-elevated">
              {getInitials(item.title)}
            </span>
            <KindBadge Icon={KindIcon} label={item.badge} />
          </div>
        ) : (
          <CardCover category={item.kind === "ai" ? "ai" : item.category} imageUrl={item.imageUrl} alt={item.title} icon={item.kind === "ai" ? Bot : undefined}>
            <KindBadge Icon={KindIcon} label={item.badge} />
          </CardCover>
        )}

        <div className="flex flex-1 flex-col gap-2 p-4">
          <span className="w-fit max-w-full truncate rounded-full border border-border px-2.5 py-0.5 text-[11px] text-text-muted">
            {item.category}
          </span>
          <h3 className="line-clamp-2 min-h-[2.75rem] font-display text-base font-semibold leading-snug text-text-primary">
            {item.title}
          </h3>
          <p className="line-clamp-1 text-xs text-text-muted">{item.subtitle}</p>

          <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-3">
            {hasRating && item.rating != null ? (
              <span className="flex items-center gap-1 font-mono text-xs font-semibold tabular-nums text-text-primary">
                <Star className="h-3.5 w-3.5 fill-accent-secondary text-accent-secondary" aria-hidden="true" />
                {item.rating.toFixed(1)}
              </span>
            ) : (
              <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
                New
              </span>
            )}
            <span className="font-mono text-sm font-semibold tabular-nums text-text-primary">{item.priceLabel}</span>
          </div>
        </div>
      </article>
    </Link>
  )
}

function KindBadge({ Icon, label }: { Icon: LucideIcon; label: string }) {
  return (
    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-line-strong bg-background/80 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted backdrop-blur">
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  )
}
