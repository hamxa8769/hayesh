"use client"

import { useCallback, useEffect, useState } from "react"
import { MessageSquareQuote, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RatingStars } from "@/components/teacher-public/RatingStars"
import { SellerAvatar } from "./seller-avatar"
import { Section } from "./section"
import { formatDate } from "@/lib/utils/format"

interface GigReview {
  id: string
  reviewer_name: string
  rating: number
  comment: string | null
  seller_reply: string | null
  seller_replied_at: string | null
  created_at: string
}

interface ReviewSummary {
  average: number
  count: number
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>
}

interface ReviewsResponse {
  enabled: boolean
  reviews: GigReview[]
  summary: ReviewSummary
}

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: ReviewsResponse }

const PAGE_SIZE = 5
const STAR_ROWS = ["5", "4", "3", "2", "1"] as const

function Skeleton() {
  return (
    <div className="grid gap-6 rounded-lg border border-border bg-surface p-6 sm:grid-cols-[10rem_1fr]" aria-hidden="true">
      <div className="flex flex-col gap-3">
        <div className="h-12 w-20 animate-pulse rounded bg-surface-elevated" />
        <div className="h-4 w-28 animate-pulse rounded bg-surface-elevated" />
      </div>
      <div className="flex flex-col gap-3">
        {STAR_ROWS.map((s) => (
          <div key={s} className="h-3 animate-pulse rounded bg-surface-elevated" />
        ))}
      </div>
    </div>
  )
}

export function ReviewsSection({ gigId, sellerName, sellerAvatar }: { gigId: string; sellerName: string; sellerAvatar: string | null }) {
  const [state, setState] = useState<State>({ status: "loading" })
  const [visible, setVisible] = useState(PAGE_SIZE)

  const load = useCallback(async (signal?: AbortSignal) => {
    setState({ status: "loading" })
    try {
      const res = await fetch(`/api/gig-reviews?gig_id=${encodeURIComponent(gigId)}`, { signal })
      if (!res.ok) throw new Error("bad status")
      const data = (await res.json()) as ReviewsResponse
      setState({ status: "ready", data })
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return
      setState({ status: "error" })
    }
  }, [gigId])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  if (state.status === "ready" && !state.data.enabled) return null

  const summary = state.status === "ready" ? state.data.summary : null
  const reviews = state.status === "ready" ? state.data.reviews : []

  return (
    <Section
      id="reviews"
      eyebrow="Reviews"
      title={summary && summary.count > 0 ? `${summary.count.toLocaleString("en-US")} ${summary.count === 1 ? "review" : "reviews"}` : "Reviews"}
    >
      {state.status === "loading" && <Skeleton />}

      {state.status === "error" && (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-border bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-text-muted">Reviews could not be loaded right now.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      )}

      {state.status === "ready" && summary && summary.count === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <MessageSquareQuote className="h-8 w-8 text-text-disabled" strokeWidth={1.5} aria-hidden="true" />
          <p className="max-w-sm text-sm text-text-muted">No reviews yet — be the first after your order.</p>
        </div>
      )}

      {state.status === "ready" && summary && summary.count > 0 && (
        <div className="flex flex-col gap-5">
          <div className="grid gap-6 rounded-lg border border-border bg-surface p-5 sm:grid-cols-[11rem_1fr] sm:gap-10 sm:p-6">
            <div className="flex flex-col justify-center gap-2">
              <p className="font-display text-5xl font-semibold tabular-nums leading-none text-text-primary">{summary.average.toFixed(1)}</p>
              <RatingStars rating={summary.average} size="md" />
              <p className="font-mono text-xs tabular-nums text-text-muted">
                Based on {summary.count.toLocaleString("en-US")} {summary.count === 1 ? "review" : "reviews"}
              </p>
            </div>
            <ul className="flex flex-col justify-center gap-2.5" aria-label="Rating distribution">
              {STAR_ROWS.map((star) => {
                const n = summary.distribution[star] ?? 0
                const pct = summary.count > 0 ? (n / summary.count) * 100 : 0
                return (
                  <li key={star} className="flex items-center gap-3 text-sm">
                    <span className="flex w-8 shrink-0 items-center gap-1 font-mono tabular-nums text-text-muted">
                      {star}
                      <Star className="h-3 w-3 fill-accent-warning text-accent-warning" aria-hidden="true" />
                    </span>
                    <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-elevated" role="presentation">
                      <span className="block h-full rounded-full aurora-bg" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-8 shrink-0 text-right font-mono tabular-nums text-text-muted">{n}</span>
                  </li>
                )
              })}
            </ul>
          </div>

          <ul className="flex flex-col gap-4">
            {reviews.slice(0, visible).map((r) => (
              <li key={r.id} className="rounded-lg border border-border bg-surface p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <SellerAvatar name={r.reviewer_name} url={null} className="h-9 w-9" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">{r.reviewer_name}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <RatingStars rating={r.rating} size="sm" />
                        <span className="font-mono text-xs tabular-nums text-text-muted">{r.rating.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                  <time dateTime={r.created_at} className="shrink-0 font-mono text-xs tabular-nums text-text-muted">
                    {formatDate(r.created_at)}
                  </time>
                </div>
                {r.comment && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-text-primary">{r.comment}</p>}
                {r.seller_reply && (
                  <div className="mt-4 rounded-md border border-border bg-surface-elevated p-4 sm:ml-6">
                    <div className="flex items-center gap-2.5">
                      <SellerAvatar name={sellerName} url={sellerAvatar} className="h-6 w-6" textClassName="text-[9px]" />
                      <p className="text-xs font-medium text-text-primary">Seller&apos;s response</p>
                      {r.seller_replied_at && (
                        <time dateTime={r.seller_replied_at} className="font-mono text-[11px] tabular-nums text-text-muted">
                          {formatDate(r.seller_replied_at)}
                        </time>
                      )}
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-text-muted">{r.seller_reply}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {reviews.length > visible && (
            <Button type="button" variant="outline" className="self-center" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
              Show more reviews
            </Button>
          )}
        </div>
      )}
    </Section>
  )
}
