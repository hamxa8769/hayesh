"use client"

import { GraduationCap, Sparkles, type LucideIcon } from "lucide-react"
import { resolveCategory } from "@/components/cards/CardCover"
import { cn } from "@/lib/utils/cn"
import { SoftLink } from "./ExploreNav"
import { AI_CATEGORY, TUTORING_CATEGORY, type CategoryCount } from "./explore-data"

function iconFor(label: string): LucideIcon {
  if (label === TUTORING_CATEGORY) return GraduationCap
  if (label === AI_CATEGORY) return Sparkles
  return resolveCategory(label).icon
}

interface CategoryRailProps {
  categories: CategoryCount[]
  activeCategory?: string
  className?: string
}

export function CategoryRail({ categories, activeCategory = "", className }: CategoryRailProps) {
  if (categories.length === 0) return null
  return (
    <nav aria-label="Browse by category" className={cn("relative", className)}>
      <ul
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
        style={{
          maskImage: "linear-gradient(90deg, transparent 0, #000 16px, #000 calc(100% - 32px), transparent 100%)",
          WebkitMaskImage: "linear-gradient(90deg, transparent 0, #000 16px, #000 calc(100% - 32px), transparent 100%)",
        }}
      >
        {categories.map(({ label, count }) => {
          const Icon = iconFor(label)
          const active = activeCategory === label
          return (
            <li key={label} className="snap-start">
              <SoftLink
                patch={{ category: active ? "" : label }}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex h-full min-w-[148px] items-center gap-3 rounded-lg border p-3 pr-4 outline-none transition-[border-color,background-color] duration-150 focus-visible:ring-2 focus-visible:ring-accent-primary/60",
                  active
                    ? "border-accent-primary/60 bg-surface-elevated"
                    : "border-border bg-surface hover:border-line-strong hover:bg-surface-elevated",
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface-elevated text-accent-primary">
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-text-primary">{label}</span>
                  <span className="font-mono text-[11px] tabular-nums text-text-muted">
                    {count} {count === 1 ? "listing" : "listings"}
                  </span>
                </span>
              </SoftLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
