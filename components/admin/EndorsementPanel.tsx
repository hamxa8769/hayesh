"use client"

import { useCallback, useEffect, useState } from "react"
import { Award, Loader2, MessageSquareQuote, Sparkles, Star, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils/cn"
import { TestimonialsManager } from "@/components/admin/TestimonialsManager"

/**
 * Real, honest endorsement controls for approved teachers.
 *
 * "Featured" and "Hayesh Verified" are both genuine, working toggles — they
 * write public.teachers.featured / public.teachers.endorsed through
 * /api/admin/endorsements (service-role write, admin role re-verified
 * server-side on every call).
 *
 * Testimonials (admin-written / imported quote attribution) live in a
 * separate table (public.testimonials, migration 015) and are managed below
 * via TestimonialsManager — reachable from this same /admin/endorsements
 * page rather than a new route, so no sidebar nav link is needed.
 */

interface TeacherEndorsementRow {
  id: string
  display_name: string
  status: string
  featured: boolean
  endorsed: boolean
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
  endorsed?: boolean
  error?: string
}

export function EndorsementPanel() {
  const [teachers, setTeachers] = useState<TeacherEndorsementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
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

  const runAction = async (
    teacher: TeacherEndorsementRow,
    action: "feature" | "unfeature" | "verify" | "unverify"
  ) => {
    const key = `${teacher.id}:${action}`
    setPendingKey(key)
    setActionError(null)
    try {
      const res = await fetch("/api/admin/endorsements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacher_id: teacher.id, action }),
      })
      const json = (await res.json()) as EndorsementActionResponse
      if (!res.ok) throw new Error(json.error ?? "Could not update teacher")

      setTeachers((prev) =>
        prev.map((t) =>
          t.id === teacher.id
            ? { ...t, featured: json.featured ?? t.featured, endorsed: json.endorsed ?? t.endorsed }
            : t
        )
      )
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not update teacher")
    } finally {
      setPendingKey(null)
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

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <div className="rounded-lg border border-line-strong bg-surface-elevated p-3 text-xs text-text-muted">
          <strong className="text-text-primary">Honest by design.</strong> Featured placement and the Hayesh
          Verified badge are both real controls that take effect immediately. Testimonials are curated,
          clearly-attributed editorial quotes managed separately below — they never inflate a teacher&apos;s real
          review count or average rating.
        </div>

        {actionError && (
          <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-4 py-3 text-sm text-accent-danger">
            {actionError}
          </div>
        )}

        {teachers.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-8 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-text-muted" aria-hidden="true" />
            <p className="mt-3 text-sm text-text-muted">No approved teachers yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-elevated text-left">
                  <th className="px-4 py-3 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
                    Teacher
                  </th>
                  <th className="px-4 py-3 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
                    Rating
                  </th>
                  <th className="px-4 py-3 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
                    Featured
                  </th>
                  <th className="px-4 py-3 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
                    Hayesh Verified
                  </th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher) => {
                  const featurePending = pendingKey === `${teacher.id}:feature` || pendingKey === `${teacher.id}:unfeature`
                  const verifyPending = pendingKey === `${teacher.id}:verify` || pendingKey === `${teacher.id}:unverify`
                  return (
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
                          disabled={featurePending}
                          onClick={() => runAction(teacher, teacher.featured ? "unfeature" : "feature")}
                        >
                          {featurePending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                          {teacher.featured ? "Featured" : "Feature"}
                        </Button>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          type="button"
                          variant={teacher.endorsed ? "aurora" : "outline"}
                          size="sm"
                          disabled={verifyPending}
                          onClick={() => runAction(teacher, teacher.endorsed ? "unverify" : "verify")}
                        >
                          {verifyPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <Award className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {teacher.endorsed ? "Verified" : "Grant badge"}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={cn("space-y-4 border-t border-line-strong pt-8")}>
        <div className="flex items-center gap-2">
          <MessageSquareQuote className="h-5 w-5 text-accent-primary" aria-hidden="true" />
          <h2 className="font-display text-xl font-semibold text-text-primary">Testimonials</h2>
        </div>
        <p className="max-w-prose text-sm text-text-muted">
          Write or edit editorial testimonials for any teacher or seller. Each one is clearly attributed and marked
          as staff-written or an imported real quote — it never merges into a teacher&apos;s real review count.
        </p>
        <TestimonialsManager />
      </div>
    </div>
  )
}
