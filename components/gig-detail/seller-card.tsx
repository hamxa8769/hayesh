import Link from "next/link"
import { BadgeCheck, CalendarDays, CheckCircle2, Clock, Languages, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MessageSellerButton } from "./message-seller-button"
import { SellerAvatar } from "./seller-avatar"
import { LEVEL_LABELS, memberSince, responseTimeLabel, type DetailSeller } from "./gig-data"

interface SellerCardProps {
  seller: DetailSeller
  gigId: string
}

function Fact({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">{label}</p>
        <p className="text-sm text-text-primary">{value}</p>
      </div>
    </div>
  )
}

export function SellerCard({ seller, gigId }: SellerCardProps) {
  const since = memberSince(seller.created_at)
  const response = responseTimeLabel(seller.response_time_hrs)
  const rating = seller.average_rating ?? 0
  const skills = seller.skills ?? []
  const languages = seller.languages ?? []

  return (
    <div className="rounded-lg border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <SellerAvatar
          name={seller.display_name}
          url={seller.avatar_url}
          online={seller.is_online}
          className="h-20 w-20"
          textClassName="text-lg"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link href={`/sellers/${seller.id}`} className="font-display text-xl font-semibold text-text-primary hover:text-accent-primary">
              {seller.display_name}
            </Link>
            {seller.level && seller.level !== "new" && (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-primary">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {LEVEL_LABELS[seller.level]}
              </span>
            )}
            {seller.is_online && (
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-success">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-success" aria-hidden="true" /> Online now
              </span>
            )}
          </div>
          {seller.tagline && <p className="mt-1 text-sm text-text-muted">{seller.tagline}</p>}
          <p className="mt-2 flex items-center gap-1.5 text-sm">
            {rating > 0 ? (
              <>
                <Star className="h-4 w-4 fill-accent-warning text-accent-warning" aria-hidden="true" />
                <span className="font-mono font-semibold tabular-nums text-text-primary">{rating.toFixed(1)}</span>
                <span className="font-mono tabular-nums text-text-muted">({seller.total_reviews ?? 0} reviews)</span>
              </>
            ) : (
              <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
                No reviews yet
              </span>
            )}
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-44">
          <MessageSellerButton gigId={gigId} redirectPath={`/marketplace/${gigId}`} variant="secondary" />
          <Button asChild variant="outline" className="w-full">
            <Link href={`/sellers/${seller.id}`}>View profile</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 border-t border-border pt-5 sm:grid-cols-2">
        {response && <Fact icon={Clock} label="Response time" value={response} />}
        {since && <Fact icon={CalendarDays} label="Member since" value={since} />}
        <Fact icon={CheckCircle2} label="Orders completed" value={(seller.completed_orders ?? 0).toLocaleString("en-US")} />
        {languages.length > 0 && <Fact icon={Languages} label="Languages" value={languages.join(", ")} />}
      </div>

      {skills.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
          {skills.map((s) => (
            <span key={s} className="rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-text-muted">
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
