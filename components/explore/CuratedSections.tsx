"use client"

import type { ReactNode } from "react"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { Reveal } from "@/components/motion/Reveal"
import { ItemCard } from "./ItemCard"
import { SoftLink } from "./ExploreNav"
import { sortItems, type ExploreItem, type ExploreParams } from "./explore-data"

interface SectionProps {
  eyebrow: string
  title: string
  seeAll: Partial<ExploreParams>
  gridClass: string
  items: ExploreItem[]
  trailing?: ReactNode
}

function Section({ eyebrow, title, seeAll, gridClass, items, trailing }: SectionProps) {
  if (items.length === 0) return null
  return (
    <Reveal>
      <section aria-label={title} className="flex flex-col gap-5">
        <header className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">{eyebrow}</p>
            <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text-primary">{title}</h2>
          </div>
          <SoftLink
            patch={seeAll}
            fresh
            className="group inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text-primary"
          >
            See all
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </SoftLink>
        </header>
        <ul className={gridClass}>
          {items.map((item) => (
            <li key={item.key} className={item.kind === "teacher" && gridClass === GRID_4 ? "col-span-2 min-w-0 sm:col-span-1" : "min-w-0"}>
              <ItemCard item={item} />
            </li>
          ))}
          {trailing}
        </ul>
      </section>
    </Reveal>
  )
}

const GRID_3 = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5"
const GRID_4 = "grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-5"

function fitRows(list: ExploreItem[], cols: number, max: number): ExploreItem[] {
  const capped = list.slice(0, max)
  return capped.length >= cols ? capped.slice(0, capped.length - (capped.length % cols)) : capped
}

const AI_STEPS = [
  { title: "Describe what you need", body: "Fill a short form — no back-and-forth." },
  { title: "AI delivers in minutes", body: "Your result arrives automatically, 24/7." },
  { title: "Revise if needed", body: "Request changes within the service’s revision limit." },
]

function AIStudioPanel({ span }: { span: number }) {
  return (
    <li
      className={cn(
        "flex min-w-0 flex-col justify-center gap-4 rounded-lg border border-dashed border-line-strong bg-surface/40 p-6 sm:col-span-2",
        span >= 3 ? "lg:col-span-3" : span === 2 ? "lg:col-span-2" : "lg:col-span-1",
      )}
    >
      <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">How HayeshAI Studio works</p>
      <ol className="flex flex-col gap-4">
        {AI_STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line-strong font-mono text-xs tabular-nums text-text-muted">
              {i + 1}
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-medium text-text-primary">{step.title}</span>
              <span className="text-sm text-text-muted">{step.body}</span>
            </span>
          </li>
        ))}
      </ol>
    </li>
  )
}

export function CuratedSections({ items }: { items: ExploreItem[] }): ReactNode {
  // Trim to full grid rows so a section never ends on an orphaned card.
  const tutors = fitRows(sortItems(items.filter((i) => i.kind === "teacher"), "recommended"), 3, 6)
  const gigs = fitRows(sortItems(items.filter((i) => i.kind === "gig"), "recommended"), 4, 8)
  const ai = sortItems(items.filter((i) => i.kind === "ai"), "recommended").slice(0, 4)
  const fresh = fitRows(sortItems(items, "newest"), 3, 3)

  return (
    <div className="flex flex-col gap-14">
      <Section eyebrow="Tutoring" title="Top-rated tutors" seeAll={{ type: "teacher" }} gridClass={GRID_3} items={tutors} />
      <Section eyebrow="Marketplace" title="Popular services" seeAll={{ type: "gig" }} gridClass={GRID_4} items={gigs} />
      <Section
        eyebrow="HayeshAI Studio"
        title="Instant delivery, no waiting"
        seeAll={{ type: "ai" }}
        gridClass={GRID_4}
        items={ai}
        trailing={ai.length < 4 ? <AIStudioPanel span={4 - ai.length} /> : null}
      />
      <Section eyebrow="Just listed" title="New on Hayesh" seeAll={{ sort: "newest" }} gridClass={GRID_3} items={fresh} />
    </div>
  )
}
