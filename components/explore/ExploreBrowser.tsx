"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { LayoutGrid, List as ListIcon, Search, SearchX } from "lucide-react"
import { Pill } from "@/components/ui/pill"
import { Reveal } from "@/components/motion/Reveal"
import { Stagger } from "@/components/motion/Stagger"
import { cn } from "@/lib/utils/cn"
import { ServiceCard } from "./ServiceCard"
import { ServiceRow } from "./ServiceRow"
import type { ServiceItem, ServiceKind } from "./explore-types"

type KindFilter = "all" | ServiceKind
type SortKey = "rating" | "popularity" | "price_asc" | "price_desc"
type ViewMode = "card" | "list"

const ALL_CATEGORY = "all"

const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "teacher", label: "Teachers" },
  { value: "gig", label: "Gigs" },
  { value: "ai", label: "AI Services" },
]

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "rating", label: "Top rated" },
  { value: "popularity", label: "Most popular" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
]

function parseKind(value: string | null): KindFilter {
  if (value === "teacher" || value === "gig" || value === "ai") return value
  return "all"
}

function parseSort(value: string | null): SortKey {
  if (value === "rating" || value === "popularity" || value === "price_asc" || value === "price_desc") return value
  return "rating"
}

function parseView(value: string | null): ViewMode {
  return value === "list" ? "list" : "card"
}

function comparePrice(a: number | null, b: number | null, direction: "asc" | "desc"): number {
  // Items with no price set always sort to the bottom, regardless of direction.
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return direction === "asc" ? a - b : b - a
}

interface ExploreBrowserProps {
  items: ServiceItem[]
}

export function ExploreBrowser({ items }: ExploreBrowserProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const kind = parseKind(searchParams.get("type"))
  const category = searchParams.get("category") || ALL_CATEGORY
  const sort = parseSort(searchParams.get("sort"))
  const view = parseView(searchParams.get("view"))

  // Local state for the search box so typing feels instant; the URL is kept
  // in sync on a short debounce rather than on every keystroke.
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "")

  const updateParams = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(patch).forEach(([key, value]) => {
        if (value === null || value === "") {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      })
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  useEffect(() => {
    const id = setTimeout(() => {
      updateParams({ q: search || null })
      // Only the debounced search value should trigger this — updateParams
      // itself is recreated whenever searchParams changes, which would
      // otherwise cause this effect to refire on every URL update.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const categories = useMemo(() => {
    const unique = Array.from(new Set(items.map((item) => item.category).filter(Boolean)))
    unique.sort((a, b) => a.localeCompare(b))
    return [ALL_CATEGORY, ...unique]
  }, [items])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const matches = items.filter((item) => {
      if (kind !== "all" && item.kind !== kind) return false
      if (category !== ALL_CATEGORY && item.category !== category) return false
      if (!query) return true
      return (
        item.title.toLowerCase().includes(query) ||
        item.subtitle.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
      )
    })

    const sorted = [...matches]
    sorted.sort((a, b) => {
      switch (sort) {
        case "popularity":
          return b.popularity - a.popularity
        case "price_asc":
          return comparePrice(a.priceValue, b.priceValue, "asc")
        case "price_desc":
          return comparePrice(a.priceValue, b.priceValue, "desc")
        case "rating":
        default:
          return (b.rating ?? -1) - (a.rating ?? -1)
      }
    })
    return sorted
  }, [items, kind, category, search, sort])

  return (
    <div>
      <Reveal className="flex flex-col gap-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teachers, gigs, and AI services..."
            aria-label="Search services"
            className="h-12 w-full rounded border border-border bg-surface pl-11 pr-4 text-sm text-text-primary placeholder:text-text-disabled transition-colors duration-150 focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {KIND_OPTIONS.map((opt) => (
              <Pill key={opt.value} active={kind === opt.value} onClick={() => updateParams({ type: opt.value === "all" ? null : opt.value })}>
                {opt.label}
              </Pill>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="explore-category">
              Category
            </label>
            <select
              id="explore-category"
              value={category}
              onChange={(e) => updateParams({ category: e.target.value === ALL_CATEGORY ? null : e.target.value })}
              className="h-9 rounded border border-border bg-surface px-3 text-xs text-text-primary transition-colors duration-150 focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === ALL_CATEGORY ? "All categories" : cat}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="explore-sort">
              Sort
            </label>
            <select
              id="explore-sort"
              value={sort}
              onChange={(e) => updateParams({ sort: e.target.value === "rating" ? null : e.target.value })}
              className="h-9 rounded border border-border bg-surface px-3 text-xs text-text-primary transition-colors duration-150 focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <div className="flex items-center overflow-hidden rounded border border-border">
              <button
                type="button"
                aria-label="Card view"
                aria-pressed={view === "card"}
                onClick={() => updateParams({ view: null })}
                className={cn(
                  "flex h-9 w-9 items-center justify-center transition-colors duration-150",
                  view === "card" ? "bg-surface-elevated text-text-primary" : "text-text-muted hover:text-text-primary"
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="List view"
                aria-pressed={view === "list"}
                onClick={() => updateParams({ view: "list" })}
                className={cn(
                  "flex h-9 w-9 items-center justify-center border-l border-border transition-colors duration-150",
                  view === "list" ? "bg-surface-elevated text-text-primary" : "text-text-muted hover:text-text-primary"
                )}
              >
                <ListIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <p className="font-mono text-xs tabular-nums text-text-muted">
          {filtered.length} {filtered.length === 1 ? "result" : "results"}
        </p>
      </Reveal>

      <div className="mt-6">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-16 text-center">
            <SearchX className="mx-auto h-10 w-10 text-text-disabled" />
            <p className="mt-4 text-text-muted">No services match — try clearing filters</p>
          </div>
        ) : view === "card" ? (
          <Stagger className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" staggerDelay={0.04}>
            {filtered.map((item) => (
              <Reveal key={`${item.kind}-${item.id}`}>
                <ServiceCard item={item} />
              </Reveal>
            ))}
          </Stagger>
        ) : (
          <Stagger className="flex flex-col gap-3" staggerDelay={0.03}>
            {filtered.map((item) => (
              <Reveal key={`${item.kind}-${item.id}`}>
                <ServiceRow item={item} />
              </Reveal>
            ))}
          </Stagger>
        )}
      </div>
    </div>
  )
}
