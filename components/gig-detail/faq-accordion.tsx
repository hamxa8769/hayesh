import { Plus } from "lucide-react"
import type { GigFaqEntry } from "@/types/database"

/** Native <details> accordion — keyboard accessible, no client JS. */
export function FaqAccordion({ items }: { items: GigFaqEntry[] }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {items.map((entry) => (
        <details key={entry.question} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-medium text-text-primary transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-primary/60 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">{entry.question}</span>
            <Plus className="h-4 w-4 shrink-0 text-text-muted transition-transform duration-200 group-open:rotate-45" aria-hidden="true" />
          </summary>
          <p className="whitespace-pre-line px-5 pb-5 text-sm leading-relaxed text-text-muted">{entry.answer}</p>
        </details>
      ))}
    </div>
  )
}
