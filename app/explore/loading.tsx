import { Navbar } from "@/components/layout/Navbar"
import { AIServiceCardSkeleton } from "@/components/explore/AIServiceCard"
import { GigCardSkeleton } from "@/components/cards/GigCard"
import { TeacherCardSkeleton } from "@/components/cards/TeacherCard"

function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-surface-elevated ${className}`} />
}

export default function ExploreLoading() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main
        className="mx-auto flex max-w-[1200px] flex-col gap-10 px-4 pb-24 pt-24 sm:px-6 sm:pt-28 lg:px-8"
        aria-busy="true"
        aria-label="Loading explore"
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Bar className="h-3 w-28" />
            <Bar className="h-12 w-full max-w-xl" />
            <Bar className="h-4 w-full max-w-md" />
          </div>
          <div className="h-14 w-full max-w-3xl animate-pulse rounded-lg border border-line-strong bg-surface" />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[62px] min-w-[148px] animate-pulse rounded-lg border border-border bg-surface" />
          ))}
        </div>
        <div className="flex flex-col gap-5">
          <Bar className="h-7 w-48" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <TeacherCardSkeleton key={i} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-5">
          <Bar className="h-7 w-48" />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
            <GigCardSkeleton />
            <GigCardSkeleton />
            <AIServiceCardSkeleton />
            <GigCardSkeleton />
          </div>
        </div>
      </main>
    </div>
  )
}
