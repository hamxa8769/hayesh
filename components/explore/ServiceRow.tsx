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

interface ServiceRowProps {
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

export function ServiceRow({ item, className }: ServiceRowProps) {
  const KindIcon = KIND_ICON[item.kind]

  return (
    <Link href={item.href} className={cn("group block", className)}>
      <article className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4 transition-all duration-150 group-hover:border-line-strong group-hover:bg-surface-elevated sm:gap-5 sm:p-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-surface-elevated sm:h-16 sm:w-16">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : item.kind === "teacher" ? (
            <span className="font-mono text-sm font-semibold text-text-muted">{getInitials(item.title)}</span>
          ) : (
            <KindIcon className="h-6 w-6 text-text-disabled" strokeWidth={1.5} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1 shrink-0">
              <KindIcon className="h-3 w-3" />
              {item.badge}
            </Badge>
            <span className="truncate rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted">
              {item.category}
            </span>
          </div>
          <h3 className="mt-1.5 truncate font-display text-sm font-semibold text-text-primary sm:text-base">
            {item.title}
          </h3>
          <p className="mt-0.5 truncate text-xs text-text-muted">{item.subtitle}</p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5 pl-2 text-right sm:gap-2">
          <span className="flex items-center gap-1 font-mono text-xs tabular-nums text-text-muted">
            <Star className="h-3.5 w-3.5 fill-accent-secondary text-accent-secondary" />
            {item.rating != null ? item.rating.toFixed(1) : "New"}
          </span>
          <span className="font-mono text-sm font-semibold tabular-nums text-text-primary whitespace-nowrap">
            {item.priceLabel}
          </span>
        </div>
      </article>
    </Link>
  )
}
