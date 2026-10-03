import type { ReactNode } from "react"
import { cn } from "@/lib/utils/cn"

interface SectionProps {
  id?: string
  eyebrow: string
  title?: string
  aside?: ReactNode
  children: ReactNode
  className?: string
}

/** Titled content block used down the gig page: mono eyebrow + display heading. */
export function Section({ id, eyebrow, title, aside, children, className }: SectionProps) {
  return (
    <section id={id} className={cn("scroll-mt-24", className)} aria-labelledby={id ? `${id}-heading` : undefined}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">{eyebrow}</p>
          {title && (
            <h2 id={id ? `${id}-heading` : undefined} className="mt-1 text-balance font-display text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
              {title}
            </h2>
          )}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}
