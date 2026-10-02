"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils/cn"
import { useExploreNav } from "./ExploreNav"
import type { CategoryCount, ExploreParams, ExploreSort, ExploreTypeFilter } from "./explore-data"

export const SORT_OPTIONS: Array<{ value: ExploreSort; label: string }> = [
  { value: "recommended", label: "Recommended" },
  { value: "top_rated", label: "Top rated" },
  { value: "popular", label: "Most popular" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "newest", label: "Newest" },
]

const TYPE_OPTIONS: Array<{ value: ExploreTypeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "teacher", label: "Tutors" },
  { value: "gig", label: "Services" },
  { value: "ai", label: "AI Studio" },
]

const RATING_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: "Any" },
  { value: 4, label: "4.0+" },
  { value: 4.5, label: "4.5+" },
]

export const FIELD_CLASS =
  "h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-disabled focus:border-accent-primary/60 focus-visible:ring-2 focus-visible:ring-accent-primary/30"

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2.5 border-0 p-0">
      <legend className="mb-2.5 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">{label}</legend>
      {children}
    </fieldset>
  )
}

function Segment<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className={cn("grid gap-1 rounded-lg border border-border bg-surface p-1", options.length > 3 ? "grid-cols-2" : "grid-cols-3")}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-8 whitespace-nowrap rounded-md px-2 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent-primary/50",
              active ? "bg-surface-elevated text-text-primary shadow-[inset_0_0_0_1px_var(--color-line-strong)]" : "text-text-muted hover:text-text-primary",
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function PriceField({
  label,
  value,
  onCommit,
}: {
  label: string
  value: number | null
  onCommit: (v: number | null) => void
}) {
  const [text, setText] = useState(value == null ? "" : String(value))
  const committed = useRef(value)

  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value
      setText(value == null ? "" : String(value))
    }
  }, [value])

  useEffect(() => {
    const parsed = text.trim() === "" ? null : Number(text)
    const next = parsed != null && Number.isFinite(parsed) && parsed >= 0 ? parsed : null
    if (next === committed.current) return
    const id = window.setTimeout(() => {
      committed.current = next
      onCommit(next)
    }, 400)
    return () => window.clearTimeout(id)
  }, [text, onCommit])

  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-text-muted">₨</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={label === "Min" ? "0" : "Any"}
          className={cn(FIELD_CLASS, "pl-7 font-mono tabular-nums")}
        />
      </div>
    </label>
  )
}

interface FilterPanelProps {
  categories: CategoryCount[]
}

export function FilterPanel({ categories }: FilterPanelProps) {
  const { params, update } = useExploreNav()
  const set = (patch: Partial<ExploreParams>) => update(patch)

  return (
    <div className="flex flex-col gap-7">
      <Group label="Sort by">
        <select
          value={params.sort}
          onChange={(e) => set({ sort: e.target.value as ExploreSort })}
          aria-label="Sort results"
          className={FIELD_CLASS}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Group>

      <Group label="Type">
        <Segment options={TYPE_OPTIONS} value={params.type} onChange={(type) => set({ type })} />
      </Group>

      <Group label="Category">
        <select
          value={params.category}
          onChange={(e) => set({ category: e.target.value })}
          aria-label="Category"
          className={FIELD_CLASS}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.label} value={c.label}>
              {c.label} ({c.count})
            </option>
          ))}
        </select>
      </Group>

      <Group label="Price (PKR)">
        <div className="flex items-end gap-2">
          <PriceField label="Min" value={params.min} onCommit={(min) => set({ min })} />
          <span className="pb-2.5 text-text-disabled" aria-hidden="true">
            –
          </span>
          <PriceField label="Max" value={params.max} onCommit={(max) => set({ max })} />
        </div>
      </Group>

      <Group label="Minimum rating">
        <Segment options={RATING_OPTIONS} value={params.rating} onChange={(rating) => set({ rating })} />
      </Group>
    </div>
  )
}
