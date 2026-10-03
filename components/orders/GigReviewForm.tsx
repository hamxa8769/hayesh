"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils/cn"
import { postJson } from "@/components/orders/order-status"
import type { GigReview } from "@/types/database"

const RATING_LABELS = ["Poor", "Fair", "Good", "Very good", "Excellent"] as const

/** Read-only star row. */
export function StarDisplay({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden="true"
          className={cn("h-3.5 w-3.5", n <= rating ? "fill-accent-warning text-accent-warning" : "text-text-disabled")}
        />
      ))}
    </span>
  )
}

export interface OrderReviewState {
  review: GigReview | null
  loading: boolean
  setReview: (review: GigReview) => void
  reload: () => Promise<void>
}

/** Loads the review (if any) for a gig order via the browser client (RLS: buyer / owning seller / admin). */
export function useOrderReview(orderId: string, enabled: boolean): OrderReviewState {
  const [review, setReview] = useState<GigReview | null>(null)
  const [loading, setLoading] = useState(enabled)

  const reload = useCallback(async () => {
    if (!enabled) return
    const supabase = createClient()
    const { data } = await supabase.from("gig_reviews").select("*").eq("gig_order_id", orderId).maybeSingle()
    setReview((data as GigReview | null) ?? null)
    setLoading(false)
  }, [orderId, enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return { review, loading, setReview, reload }
}

export interface GigReviewFormProps {
  orderId: string
  onSubmitted: (review: GigReview) => void
  onCancel?: () => void
}

export function GigReviewForm({ orderId, onSubmitted, onCancel }: GigReviewFormProps) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const shown = hover || rating

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault()
      setRating((r) => Math.min(5, r + 1))
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault()
      setRating((r) => Math.max(1, r - 1))
    } else if (/^[1-5]$/.test(e.key)) {
      setRating(Number(e.key))
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rating < 1) {
      setError("Choose a star rating first.")
      return
    }
    setSubmitting(true)
    setError(null)
    const res = await postJson<{ review: GigReview }>("/api/gig-reviews", {
      gig_order_id: orderId,
      rating,
      comment: comment.trim(),
    })
    setSubmitting(false)
    if (res.error || !res.data) {
      setError(res.error ?? "Could not save your review.")
      return
    }
    onSubmitted(res.data.review)
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-border bg-surface p-3">
      <div>
        <p id={`rating-label-${orderId}`} className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
          Your rating
        </p>
        <div
          role="radiogroup"
          aria-labelledby={`rating-label-${orderId}`}
          className="mt-1.5 flex items-center gap-1"
          onKeyDown={onKeyDown}
          onMouseLeave={() => setHover(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? "s" : ""} — ${RATING_LABELS[n - 1]}`}
              tabIndex={rating === n || (rating === 0 && n === 1) ? 0 : -1}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onFocus={() => setHover(0)}
              className="rounded p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60"
            >
              <Star
                aria-hidden="true"
                className={cn(
                  "h-6 w-6 transition-colors",
                  n <= shown ? "fill-accent-warning text-accent-warning" : "text-text-disabled",
                )}
              />
            </button>
          ))}
          <span className="ml-2 text-xs text-text-muted" aria-live="polite">
            {shown > 0 ? RATING_LABELS[shown - 1] : ""}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`review-comment-${orderId}`} className="text-sm text-text-primary">
          Comment <span className="text-text-muted">(optional)</span>
        </label>
        <textarea
          id={`review-comment-${orderId}`}
          rows={3}
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="How was working with this seller?"
          className="flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
        />
        <p className="text-right font-mono text-[10px] tabular-nums text-text-muted">{comment.length}/2000</p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-accent-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="aurora" size="sm" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Submit review
        </Button>
      </div>
    </form>
  )
}
