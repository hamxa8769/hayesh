import { cn } from "@/lib/utils/cn"
import type { SellerProfileValues } from "@/components/seller/seller-profile-schema"

export interface ProfileCompletionCardProps {
  values: SellerProfileValues
  kycStarted: boolean
  className?: string
}

interface ChecklistItem {
  label: string
  done: boolean
}

export function ProfileCompletionCard({ values, kycStarted, className }: ProfileCompletionCardProps) {
  const items: ChecklistItem[] = [
    { label: "Display name", done: Boolean(values.display_name?.trim()) },
    { label: "Tagline", done: Boolean(values.tagline?.trim()) },
    { label: "Avatar", done: Boolean(values.avatar_url?.trim()) },
    { label: "Skills", done: values.skills.length > 0 },
    { label: "Languages", done: values.languages.length > 0 },
    { label: "Portfolio links", done: values.portfolio_urls.length > 0 },
    { label: "Verification started", done: kycStarted },
  ]

  const completed = items.filter((item) => item.done).length
  const percent = Math.round((completed / items.length) * 100)

  return (
    <div className={cn("relative overflow-hidden rounded-lg border border-border bg-surface p-5", className)}>
      <span aria-hidden="true" className="aurora-bg absolute inset-x-0 top-0 h-[2px]" />

      <div className="flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Profile Completion</p>
        <p className="font-mono text-sm font-semibold tabular-nums text-text-primary">{percent}%</p>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
        <div className="aurora-bg h-full rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>

      <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={item.label}
            className={cn("flex items-center gap-2 text-xs", item.done ? "text-text-primary" : "text-text-muted")}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", item.done ? "bg-accent-success" : "bg-text-disabled")} />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
