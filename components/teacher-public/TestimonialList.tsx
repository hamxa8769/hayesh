"use client"

import { useEffect, useState } from "react"
import { MessageSquareQuote } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { RatingStars } from "@/components/teacher-public/RatingStars"
import { cn } from "@/lib/utils/cn"

interface PublicTestimonial {
  id: string
  author_name: string
  author_role: string | null
  rating: number | null
  body: string
}

export interface TestimonialListProps {
  /** teachers.id or sellers.id — the polymorphic public.testimonials.subject_id */
  subjectId: string
  subjectType?: "teacher" | "seller"
  className?: string
}

/**
 * Public display of admin-curated testimonials for a teacher/seller profile.
 * These are editorial quotes — separate from public.teacher_reviews (the
 * real parent-submitted reviews rendered by ReviewList.tsx) — so every card
 * carries a "Testimonial" label and this list never touches
 * average_rating/total_reviews.
 *
 * Renders nothing (not an error state) when there are simply no published
 * testimonials yet, so an unused profile doesn't show a broken-looking
 * empty panel.
 */
export function TestimonialList({ subjectId, subjectType = "teacher", className }: TestimonialListProps) {
  const [testimonials, setTestimonials] = useState<PublicTestimonial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      const { data, error: fetchError } = await supabase
        .from("testimonials")
        .select("id, author_name, author_role, rating, body")
        .eq("subject_type", subjectType)
        .eq("subject_id", subjectId)
        .eq("is_published", true)
        .order("created_at", { ascending: false })

      if (cancelled) return

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      setTestimonials((data ?? []) as PublicTestimonial[])
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [subjectId, subjectType])

  if (loading) {
    return (
      <div className={cn("space-y-3", className)} aria-busy="true" aria-label="Loading testimonials">
        {[0, 1].map((i) => (
          <div key={i} className="animate-pulse rounded-lg border border-line-strong bg-surface p-4">
            <div className="h-3 w-24 rounded bg-surface-elevated" />
            <div className="mt-3 h-3 w-full rounded bg-surface-elevated" />
            <div className="mt-2 h-3 w-2/3 rounded bg-surface-elevated" />
          </div>
        ))}
      </div>
    )
  }

  // Fail quiet: a broken/empty testimonial panel is worse than no panel.
  if (error || testimonials.length === 0) {
    return null
  }

  return (
    <div className={cn("space-y-3", className)}>
      <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Testimonials</span>
      {testimonials.map((t) => (
        <div key={t.id} className="relative overflow-hidden rounded-lg border border-line-strong bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <MessageSquareQuote className="h-4 w-4 shrink-0 text-accent-primary/70" aria-hidden="true" />
            <span className="rounded-full border border-line-strong bg-surface-elevated px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
              Testimonial
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-text-primary">&ldquo;{t.body}&rdquo;</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-text-primary">{t.author_name}</p>
              {t.author_role && <p className="text-xs text-text-muted">{t.author_role}</p>}
            </div>
            {t.rating && <RatingStars rating={t.rating} size="sm" />}
          </div>
        </div>
      ))}
    </div>
  )
}
