import { cn } from "@/lib/utils/cn"
import type { Teacher } from "@/types/database"

export interface TeacherProfileCompletionCardProps {
  teacher: Pick<
    Teacher,
    | "display_name"
    | "tagline"
    | "profile_photo_url"
    | "education"
    | "experience"
    | "subjects"
    | "availability"
    | "group_price_pkr"
    | "standard_price_pkr"
    | "private_price_pkr"
  >
  className?: string
}

interface ChecklistItem {
  label: string
  done: boolean
}

export function TeacherProfileCompletionCard({ teacher, className }: TeacherProfileCompletionCardProps) {
  const hasPricing = Boolean(teacher.group_price_pkr || teacher.standard_price_pkr || teacher.private_price_pkr)
  const hasAvailability = Boolean(teacher.availability && Object.keys(teacher.availability).length > 0)

  const items: ChecklistItem[] = [
    { label: "Display name", done: Boolean(teacher.display_name?.trim()) },
    { label: "Tagline", done: Boolean(teacher.tagline?.trim()) },
    { label: "Profile photo", done: Boolean(teacher.profile_photo_url?.trim()) },
    { label: "Education", done: Boolean(teacher.education && teacher.education.length > 0) },
    { label: "Experience", done: Boolean(teacher.experience && teacher.experience.length > 0) },
    { label: "Subjects", done: Boolean(teacher.subjects && teacher.subjects.length > 0) },
    { label: "Availability", done: hasAvailability },
    { label: "Session pricing", done: hasPricing },
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
