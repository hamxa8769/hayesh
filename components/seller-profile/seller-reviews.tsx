import { RatingStars } from "@/components/teacher-public/RatingStars"
import { SellerAvatar } from "@/components/gig-detail/seller-avatar"
import { formatDate } from "@/lib/utils/format"
import Link from "next/link"

export interface SellerReviewItem {
  id: string
  gig_id: string
  gig_title: string | null
  reviewer_name: string
  rating: number
  comment: string | null
  created_at: string
}

export function SellerReviews({ reviews }: { reviews: SellerReviewItem[] }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {reviews.map((r) => (
        <li key={r.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <SellerAvatar name={r.reviewer_name} url={null} className="h-9 w-9" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">{r.reviewer_name}</p>
                <RatingStars rating={r.rating} size="sm" />
              </div>
            </div>
            <time dateTime={r.created_at} className="shrink-0 font-mono text-xs tabular-nums text-text-muted">{formatDate(r.created_at)}</time>
          </div>
          {r.comment && <p className="line-clamp-5 whitespace-pre-line text-sm leading-relaxed text-text-primary">{r.comment}</p>}
          {r.gig_title && (
            <Link href={`/marketplace/${r.gig_id}`} className="mt-auto truncate border-t border-border pt-3 text-xs text-text-muted transition-colors hover:text-text-primary">
              On: {r.gig_title}
            </Link>
          )}
        </li>
      ))}
    </ul>
  )
}
