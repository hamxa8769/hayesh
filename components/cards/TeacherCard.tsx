import Link from "next/link"
import { BadgeCheck, Star } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { formatPKR } from "@/lib/utils/format"
import type { Teacher } from "@/types/database"
import { CARD_LINK_CLASS, CARD_SURFACE_CLASS, getInitials } from "./card-utils"

export interface TeacherCardProps {
  id: string
  displayName: string
  photoUrl: string | null
  tagline: string | null
  subjects: string[]
  rating: number | null
  totalReviews: number | null
  totalStudents: number | null
  /** Lowest monthly price in PKR, null when no tier is priced. */
  lowestPrice: number | null
  translationEnabled?: boolean | null
  featured?: boolean
  className?: string
}

const MAX_SUBJECTS = 3

export function TeacherCard({
  id,
  displayName,
  photoUrl,
  tagline,
  subjects,
  rating,
  totalReviews,
  totalStudents,
  lowestPrice,
  translationEnabled,
  featured = false,
  className,
}: TeacherCardProps) {
  const visible = subjects.slice(0, MAX_SUBJECTS)
  const overflow = subjects.length - visible.length
  const hasRating = rating != null && rating > 0

  return (
    <Link href={`/teachers/${id}`} className={cn(CARD_LINK_CLASS, className)}>
      <article className={cn(CARD_SURFACE_CLASS, "gap-4 p-5")}>
        <div className="flex items-start gap-3.5">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={displayName}
              loading="lazy"
              className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-accent-primary/40 ring-offset-2 ring-offset-surface"
            />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-primary/10 font-mono text-base font-semibold text-accent-primary ring-2 ring-accent-primary/40 ring-offset-2 ring-offset-surface">
              {getInitials(displayName)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-display text-base font-semibold text-text-primary">{displayName}</h3>
              <BadgeCheck className="h-4 w-4 shrink-0 text-accent-primary" aria-label="Verified teacher" />
            </div>
            <p className="mt-0.5 line-clamp-1 text-sm text-text-muted">{tagline || "Verified teacher"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {featured && (
                <span className="rounded-full bg-accent-secondary px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-background">
                  Featured
                </span>
              )}
              {translationEnabled && (
                <span className="rounded-full border border-accent-primary/40 bg-accent-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-accent-primary">
                  &#10022; Multilingual
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex min-h-[1.75rem] flex-wrap content-start gap-1.5">
          {visible.map((subject) => (
            <span key={subject} className="rounded-full border border-border bg-surface-elevated px-2.5 py-1 text-xs text-text-muted">
              {subject}
            </span>
          ))}
          {overflow > 0 && (
            <span className="rounded-full border border-border px-2.5 py-1 text-xs text-text-disabled">+{overflow}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          {hasRating ? (
            <>
              <Star className="h-3.5 w-3.5 fill-accent-secondary text-accent-secondary" aria-hidden="true" />
              <span className="font-mono font-semibold tabular-nums text-text-primary">{rating.toFixed(1)}</span>
              <span className="font-mono tabular-nums text-text-muted">({totalReviews ?? 0} reviews)</span>
            </>
          ) : (
            <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
              New
            </span>
          )}
          {totalStudents != null && totalStudents > 0 && (
            <span className="font-mono tabular-nums text-text-muted">&middot; {totalStudents} students</span>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-3">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">From</span>
            <span className="font-mono text-base font-semibold tabular-nums text-text-primary">
              {lowestPrice != null ? (
                <>
                  {formatPKR(lowestPrice)}
                  <span className="text-xs font-normal text-text-muted">/mo</span>
                </>
              ) : (
                "—"
              )}
            </span>
          </div>
          <span className="rounded-full border border-accent-success/40 bg-accent-success/10 px-2.5 py-1 text-xs font-medium text-accent-success">
            Free demo
          </span>
        </div>
      </article>
    </Link>
  )
}

export function TeacherCardSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4 rounded-lg border border-border bg-surface p-5" aria-hidden="true">
      <div className="flex items-start gap-3.5">
        <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-surface-elevated" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 w-32 animate-pulse rounded bg-surface-elevated" />
          <div className="h-3 w-44 animate-pulse rounded bg-surface-elevated" />
        </div>
      </div>
      <div className="flex gap-1.5">
        <div className="h-6 w-16 animate-pulse rounded-full bg-surface-elevated" />
        <div className="h-6 w-20 animate-pulse rounded-full bg-surface-elevated" />
      </div>
      <div className="h-3 w-36 animate-pulse rounded bg-surface-elevated" />
      <div className="mt-auto border-t border-border pt-3">
        <div className="h-8 w-28 animate-pulse rounded bg-surface-elevated" />
      </div>
    </div>
  )
}

/** Maps a full `teachers` row to TeacherCard props (featured honours featured_until). */
export function teacherCardPropsFromRow(t: Teacher): Omit<TeacherCardProps, "className"> {
  const prices = [t.group_price_pkr, t.standard_price_pkr, t.private_price_pkr].filter(
    (p): p is number => typeof p === "number" && p > 0
  )
  return {
    id: t.id,
    displayName: t.display_name,
    photoUrl: t.profile_photo_url,
    tagline: t.tagline,
    subjects: ((t.subjects || []) as Array<{ subject: string }>).map((s) => s.subject),
    rating: t.average_rating,
    totalReviews: t.total_reviews,
    totalStudents: t.total_students,
    lowestPrice: prices.length > 0 ? Math.min(...prices) : null,
    translationEnabled: t.translation_enabled,
    featured: Boolean(t.featured) && (!t.featured_until || new Date(t.featured_until).getTime() > Date.now()),
  }
}
