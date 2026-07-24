"use client"

import Link from "next/link"
import { Bot, ShoppingBag, Star, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils/cn"
import type { ServiceItem } from "./explore-types"

const KIND_ICON: Record<ServiceItem["kind"], typeof Users> = {
  teacher: Users,
  gig: ShoppingBag,
  ai: Bot,
}

interface ServiceCardProps {
  item: ServiceItem
  className?: string
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?"
}

export function ServiceCard({ item, className }: ServiceCardProps) {
  const KindIcon = KIND_ICON[item.kind]

  return (
    <Link href={item.href} className={cn("group block h-full", className)}>
      <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface transition-all duration-150 group-hover:-translate-y-0.5 group-hover:border-line-strong group-hover:bg-surface-elevated group-hover:shadow-[0_12px_30px_rgba(0,0,0,0.4),0_0_20px_rgba(39,196,160,0.1)]">
        <div className="relative flex h-32 shrink-0 items-center justify-center border-b border-border bg-surface-elevated">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : item.kind === "teacher" ? (
            <span className="font-mono text-2xl font-semibold text-text-muted">{getInitials(item.title)}</span>
          ) : (
            <KindIcon className="h-8 w-8 text-text-disabled" strokeWidth={1.5} />
          )}
          <Badge variant="secondary" className="absolute left-3 top-3 gap-1">
            <KindIcon className="h-3 w-3" />
            {item.badge}
          </Badge>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <span className="w-fit truncate rounded-full border border-border px-2.5 py-0.5 text-[11px] text-text-muted">
            {item.category}
          </span>

          <h3 className="mt-3 line-clamp-2 font-display text-base font-semibold leading-snug text-text-primary">
            {item.title}
          </h3>
          <p className="mt-1 line-clamp-1 text-xs text-text-muted">{item.subtitle}</p>

          <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-4">
            <span className="flex items-center gap-1 font-mono text-xs tabular-nums text-text-muted">
              <Star className="h-3.5 w-3.5 fill-accent-secondary text-accent-secondary" />
              {item.rating != null ? item.rating.toFixed(1) : "New"}
            </span>
            <span className="font-mono text-sm font-semibold tabular-nums text-text-primary">{item.priceLabel}</span>
          </div>
        </div>
      </article>
    </Link>
  )
}
