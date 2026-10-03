import { GigCard } from "@/components/marketplace/GigCard"
import type { GigCardSeller } from "@/components/cards/GigCard"
import type { Gig } from "@/types/database"

export type GigWithSeller = Gig & { sellers: GigCardSeller | null }

interface GigCardGridProps {
  gigs: GigWithSeller[]
  /** Column count on wide screens inside the content column. */
  columns?: 2 | 3 | 4
}

const COLS: Record<NonNullable<GigCardGridProps["columns"]>, string> = {
  2: "",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-3 xl:grid-cols-4",
}

export function GigCardGrid({ gigs, columns = 2 }: GigCardGridProps) {
  return (
    <div className={`grid grid-cols-2 gap-3 sm:gap-5 ${COLS[columns]}`}>
      {gigs.map((g) => (
        <GigCard key={g.id} gig={g} seller={g.sellers} />
      ))}
    </div>
  )
}
