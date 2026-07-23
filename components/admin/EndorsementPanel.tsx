"use client"

import { useCallback, useEffect, useState } from "react"
import { Award, Import, Loader2, Sparkles, Star, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils/cn"

/**
 * Real, honest endorsement controls for approved teachers.
 *
 * "Featured" is a genuine, working toggle — it writes public.teachers.featured
 * through /api/admin/endorsements (service-role write; migration 001 revoked
 * client-side UPDATE on that column entirely).
 *
 * "Hayesh Verified badge" and "Import testimonial" are deliberately disabled.
 * The current schema has no column to carry either honestly: no
 * teachers.endorsed / verified flag, and teacher_reviews has no field to
 * attribute a review to an imported real source or mark it verified. Rather
 * than fabricate reviews or fake a badge, these controls stay visible but
 * inert, with a tooltip explaining exactly what schema change unblocks them.
 */

interface TeacherEndorsementRow {
  id: string
  display_name: string
  status: string
  featured: boolean
  average_rating: number
  total_reviews: number
}

interface EndorsementsListResponse {
  teachers?: TeacherEndorsementRow[]
  error?: string
}

interface EndorsementActionResponse {
  id?: string
  featured?: boolean
  error?: string
}

export function EndorsementPanel() {
  const [teachers, setTeachers] = useState<TeacherEndorsementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch("/api/admin/endorsements")
      const json = (await res.json()) as EndorsementsListResponse
      if (!res.ok) throw new Error(json.error ?? "Could not load teachers")
      setTeachers(json.teachers ?? [])
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load teachers")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggleFeatured = async (teacher: TeacherEndorsementRow) => {
    setPendingId(teacher.id)
    setActionError(null)
    try {
      const res = await fetch("/api/admin/endorsements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacher_id: teacher.id,
          action: teacher.featured ? "unfeature" : "feature",
        }),
      })
      const json = (await res.json()) as EndorsementActionResponse
      if (!res.ok) throw new Error(json.error ?? "Could not update featured status")

      setTeachers((prev) =>
        prev.map((t) => (t.id === teacher.id ? { ...t, featured: json.featured ?? !t.featured } : t))
      )
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not update featured status")
    } finally {
      setPendingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-surface" />
        ))}
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-6 text-center">
        <TriangleAlert className="mx-auto h-8 w-8 text-accent-danger" aria-hidden="true" />
        <p className="mt-3 text-sm text-accent-danger">{loadError}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={load}>
          Try again
        </Button>
      </div>
    )
  }

  if (teachers.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <Sparkles className="mx-auto h-8 w-8 text-text-muted" aria-hidden="true" />
        <p className="mt-3 text-sm text-text-muted">No approved teachers yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-line-strong bg-surface-elevated p-3 text-xs text-text-muted">
        <strong className="text-text-primary">Honest by design.</strong> Featured placement is real and takes effect
        immediately. Verified badges and testimonial imports are disabled below until the platform has a way to
        attribute them to a real, verifiable source — see the tooltips on those controls.
      </div>

      {actionError && (
        <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-4 py-3 text-sm text-accent-danger">
          {actionError}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-elevated text-left">
              <th className="px-4 py-3 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Teacher</th>
              <th className="px-4 py-3 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Rating</th>
              <th className="px-4 py-3 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Featured</th>
              <th className="px-4 py-3 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
                Hayesh Verified
              </th>
              <th className="px-4 py-3 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
                Import testimonial
              </th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((teacher) => (
              <tr key={teacher.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3 text-text-primary">{teacher.display_name}</td>
                <td className="px-4 py-3 font-mono tabular-nums text-text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-accent-warning" aria-hidden="true" />
                    {teacher.average_rating.toFixed(1)}
                    <span className="text-text-disabled">({teacher.total_reviews})</span>
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Button
                    type="button"
                    variant={teacher.featured ? "aurora" : "outline"}
                    size="sm"
                    disabled={pendingId === teacher.id}
                    onClick={() => toggleFeatured(teacher)}
                  >
                    {pendingId === teacher.id && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                    {teacher.featured ? "Featured" : "Feature"}
                  </Button>
                </td>
                <td className="px-4 py-3">
                  <span
                    title="Needs a schema change: public.teachers has no `endorsed`/`verified` column yet. Add one in a future migration to enable this control."
                    className={cn(
                      "inline-flex cursor-not-allowed items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                      "border-border bg-surface-elevated text-text-disabled"
                    )}
                  >
                    <Award className="h-3.5 w-3.5" aria-hidden="true" />
                    Grant badge
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    title="Needs a schema change: no table exists to attribute an imported review to a real, verifiable author. Add a public.testimonials table (author_name, source_url, verified) to enable this control."
                    className={cn(
                      "inline-flex cursor-not-allowed items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                      "border-border bg-surface-elevated text-text-disabled"
                    )}
                  >
                    <Import className="h-3.5 w-3.5" aria-hidden="true" />
                    Import
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
