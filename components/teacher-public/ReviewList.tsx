"use client"

import { useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { AlertCircle, MessageSquareOff } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { RatingStars } from "@/components/teacher-public/RatingStars"
import type { TeacherReview } from "@/types/database"

interface ReviewerProfile {
  full_name: string | null
  avatar_url: string | null
}

interface ReviewWithReviewer extends TeacherReview {
  profiles: ReviewerProfile | null
}

export interface ReviewListSummary {
  average: number | null
  count: number
}

export interface ReviewListProps {
  teacherId: string
  /** Bump this to force a refetch, e.g. right after a new review is submitted. */
  refreshKey?: number
  /** Reports the live average + count computed from the fetched reviews, so the
   * page header can display a number that always matches what's shown below —
   * see the average_rating TODO in ReviewForm.tsx for why the stored column
   * can't be trusted for this yet. */
  onSummaryChange?: (summary: ReviewListSummary) => void
}

function getInitials(name: string | null): string {
  if (!name) return "?"
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

export function ReviewList({ teacherId, refreshKey = 0, onSummaryChange }: ReviewListProps) {
  const [reviews, setReviews] = useState<ReviewWithReviewer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      const { data, error: fetchError } = await supabase
        .from("teacher_reviews")
        .select("*, profiles(full_name, avatar_url)")
        .eq("teacher_id", teacherId)
        .order("created_at", { ascending: false })

      if (cancelled) return

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      const rows = (data || []) as unknown as ReviewWithReviewer[]
      setReviews(rows)
      setLoading(false)

      if (onSummaryChange) {
        if (rows.length === 0) {
          onSummaryChange({ average: null, count: 0 })
        } else {
          const total = rows.reduce((sum, r) => sum + r.rating, 0)
          onSummaryChange({ average: total / rows.length, count: rows.length })
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
    // onSummaryChange intentionally excluded: callers pass an inline setter and
    // including it would refetch on every parent render instead of only when
    // the teacher or refreshKey actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, refreshKey])

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading reviews">
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-lg border border-border bg-surface p-4">
            <div className="h-3 w-24 rounded bg-surface-elevated" />
            <div className="mt-3 h-3 w-full rounded bg-surface-elevated" />
            <div className="mt-2 h-3 w-2/3 rounded bg-surface-elevated" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-4 text-sm text-accent-danger">
        <AlertCircle className="h-4 w-4 shrink-0" /> Could not load reviews: {error}
      </div>
    )
  }

  if (reviews.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
        <MessageSquareOff className="mx-auto h-6 w-6 text-text-disabled" />
        <p className="mt-2 text-sm text-text-muted">No reviews yet — be the first to leave one.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <div key={review.id} className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-start gap-3">
            {review.profiles?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={review.profiles.avatar_url}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full border border-border object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-elevated font-mono text-xs font-semibold text-text-muted">
                {getInitials(review.profiles?.full_name ?? null)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="truncate text-sm font-medium text-text-primary">
                  {review.profiles?.full_name || "Hayesh user"}
                </p>
                <span className="font-mono text-xs tabular-nums text-text-disabled">
                  {review.created_at ? formatDistanceToNow(new Date(review.created_at), { addSuffix: true }) : ""}
                </span>
              </div>
              <RatingStars rating={review.rating} size="sm" className="mt-1.5" />
              {review.comment && <p className="mt-2 text-sm leading-relaxed text-text-muted">{review.comment}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
