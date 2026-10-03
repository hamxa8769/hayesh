"use client"

import { useMemo } from "react"
import { Reveal } from "@/components/motion/Reveal"
import { CategoryRail } from "./CategoryRail"
import { CuratedSections } from "./CuratedSections"
import { ExploreHero } from "./ExploreHero"
import { ExploreNavProvider, useExploreNav } from "./ExploreNav"
import { QuickActions } from "./QuickActions"
import { ResultsView } from "./ResultsView"
import { categoryCounts, isResultsMode, type ExploreItem, type ExploreViewer } from "./explore-data"

interface ExploreExperienceProps {
  items: ExploreItem[]
  viewer: ExploreViewer | null
}

function Experience({ items, viewer }: ExploreExperienceProps) {
  const { params } = useExploreNav()
  const categories = useMemo(() => categoryCounts(items), [items])
  const resultsMode = isResultsMode(params)

  return (
    <div className="flex flex-col gap-10">
      <ExploreHero viewer={viewer} resultsMode={resultsMode} />

      {resultsMode ? (
        <ResultsView items={items} categories={categories} />
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong bg-surface/50 p-12 text-center">
          <h2 className="font-display text-lg font-semibold text-text-primary">Nothing listed yet</h2>
          <p className="mt-1 text-sm text-text-muted">
            Approved teachers, seller gigs and AI services will appear here as they go live.
          </p>
        </div>
      ) : (
        <>
          {viewer?.role && (
            <Reveal>
              <QuickActions role={viewer.role} />
            </Reveal>
          )}
          <Reveal delay={0.05}>
            <section aria-label="Categories" className="flex flex-col gap-3">
              <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Browse by category</h2>
              <CategoryRail categories={categories} />
            </section>
          </Reveal>
          <CuratedSections items={items} />
        </>
      )}
    </div>
  )
}

export function ExploreExperience(props: ExploreExperienceProps) {
  return (
    <ExploreNavProvider>
      <Experience {...props} />
    </ExploreNavProvider>
  )
}
