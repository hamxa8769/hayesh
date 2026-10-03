"use client"

import { useMemo, useState } from "react"
import { SearchX, SlidersHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatPKR } from "@/lib/utils/format"
import { FilterPanel, SORT_OPTIONS } from "./FilterPanel"
import { FilterSheet } from "./FilterSheet"
import { ItemCard } from "./ItemCard"
import { SoftLink, useExploreNav } from "./ExploreNav"
import { filterItems, type CategoryCount, type ExploreItem, type ExploreParams } from "./explore-data"

const TYPE_LABEL = { teacher: "Tutors", gig: "Services", ai: "AI Studio" } as const
const EMPTY_SUGGESTIONS = ["Maths tutor", "Logo design", "IELTS", "CV rewrite"]

interface Chip {
  key: string
  label: string
  clear: Partial<ExploreParams>
}

function activeChips(p: ExploreParams): Chip[] {
  const chips: Chip[] = []
  if (p.q.trim()) chips.push({ key: "q", label: `“${p.q.trim()}”`, clear: { q: "" } })
  if (p.type !== "all") chips.push({ key: "type", label: TYPE_LABEL[p.type], clear: { type: "all" } })
  if (p.category) chips.push({ key: "category", label: p.category, clear: { category: "" } })
  if (p.min != null) chips.push({ key: "min", label: `From ${formatPKR(p.min)}`, clear: { min: null } })
  if (p.max != null) chips.push({ key: "max", label: `Up to ${formatPKR(p.max)}`, clear: { max: null } })
  if (p.rating > 0) chips.push({ key: "rating", label: `${p.rating.toFixed(1)}+ rating`, clear: { rating: 0 } })
  return chips
}

export function ResultsView({ items, categories }: { items: ExploreItem[]; categories: CategoryCount[] }) {
  const { params, update } = useExploreNav()
  const [sheetOpen, setSheetOpen] = useState(false)
  const results = useMemo(() => filterItems(items, params), [items, params])
  const chips = activeChips(params)

  const heading = params.q.trim()
    ? `${results.length} ${results.length === 1 ? "result" : "results"} for “${params.q.trim()}”`
    : params.category
      ? params.category
      : params.type !== "all"
        ? TYPE_LABEL[params.type]
        : "All listings"
  const sortLabel = SORT_OPTIONS.find((o) => o.value === params.sort)?.label

  const clearAll = () =>
    update({ q: "", type: "all", category: "", min: null, max: null, rating: 0, sort: "recommended" })

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
      <aside className="hidden lg:block" aria-label="Filters">
        <div className="sticky top-24 rounded-lg border border-border bg-surface/60 p-5">
          <FilterPanel categories={categories} />
        </div>
      </aside>

      <section className="flex min-w-0 flex-col gap-5" aria-live="polite">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
              {params.q.trim() ? "Search" : "Browse"}
              {sortLabel && params.sort !== "recommended" ? ` · ${sortLabel}` : ""}
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text-primary">{heading}</h2>
            {!params.q.trim() && (
              <p className="font-mono text-xs tabular-nums text-text-muted">
                {results.length} {results.length === 1 ? "listing" : "listings"}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setSheetOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" />
            Filters{chips.length > 0 ? ` (${chips.length})` : ""}
          </Button>
        </header>

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => update(c.clear)}
                aria-label={`Remove filter ${c.label}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface-elevated py-1 pl-3 pr-2 text-sm text-text-primary transition-colors hover:border-accent-primary/50"
              >
                {c.label}
                <X className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
              </button>
            ))}
            <button
              type="button"
              onClick={clearAll}
              className="px-1.5 text-sm text-text-muted underline-offset-4 transition-colors hover:text-text-primary hover:underline"
            >
              Clear all
            </button>
          </div>
        )}

        {results.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-line-strong bg-surface/50 px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-surface-elevated text-text-muted">
              <SearchX className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="font-display text-lg font-semibold text-text-primary">
                {params.q.trim() ? `No results for “${params.q.trim()}”` : "Nothing matches these filters"}
              </h3>
              <p className="text-sm text-text-muted">Check the spelling, loosen your filters, or try one of these.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {EMPTY_SUGGESTIONS.map((s) => (
                <SoftLink
                  key={s}
                  patch={{ q: s }}
                  fresh
                  className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-text-muted transition-colors hover:border-line-strong hover:text-text-primary"
                >
                  {s}
                </SoftLink>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={clearAll}>
              Clear all filters
            </Button>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-5">
            {results.map((item) => (
              // Tutor cards are text-rich, so they take a full row on phones;
              // service/AI cards pair up two-per-row.
              <li key={item.key} className={item.kind === "teacher" ? "col-span-2 min-w-0 sm:col-span-1" : "min-w-0"}>
                <ItemCard item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <FilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} resultCount={results.length}>
        <FilterPanel categories={categories} />
      </FilterSheet>
    </div>
  )
}
