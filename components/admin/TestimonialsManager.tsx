"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Check, Loader2, MessageSquareQuote, Pencil, Plus, Star, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils/cn"
import {
  TestimonialFormModal,
  type TestimonialRecord,
  type TestimonialSubjectType,
} from "@/components/admin/TestimonialFormModal"

interface SubjectOption {
  id: string
  display_name: string
}

interface FetchState {
  testimonials: TestimonialRecord[]
  loading: boolean
  error: string | null
}

type SubjectFilter = "all" | TestimonialSubjectType

const FILTER_OPTIONS: { value: SubjectFilter; label: string }[] = [
  { value: "all", label: "All profiles" },
  { value: "teacher", label: "Teachers only" },
  { value: "seller", label: "Sellers only" },
]

const selectClassName =
  "h-9 rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text-primary transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary"

/**
 * Admin CRUD surface for public.testimonials — the manually-written /
 * imported editorial quotes shown on teacher and seller profiles. Reachable
 * from /admin/endorsements (embedded via EndorsementPanel) rather than a new
 * route, so no sidebar nav link is required.
 *
 * Reads/writes go through /api/admin/testimonials (service-role client,
 * admin role re-verified server-side). Subject display names are resolved
 * client-side against the public "approved teachers/sellers visible to
 * everyone" read policies, purely for a friendly label in this table — no
 * testimonial data is ever written outside the API route.
 */
export function TestimonialsManager() {
  const [state, setState] = useState<FetchState>({ testimonials: [], loading: true, error: null })
  const [subjectNames, setSubjectNames] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<SubjectFilter>("all")
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTestimonial, setEditingTestimonial] = useState<TestimonialRecord | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch("/api/admin/testimonials")
      const json = (await res.json()) as { testimonials?: TestimonialRecord[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? "Failed to load testimonials")
      setState({ testimonials: json.testimonials ?? [], loading: false, error: null })
    } catch (e: unknown) {
      setState({
        testimonials: [],
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load testimonials",
      })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    let cancelled = false

    const loadNames = async () => {
      try {
        const supabase = createClient()
        const [teachersRes, sellersRes] = await Promise.all([
          supabase.from("teachers").select("id, display_name"),
          supabase.from("sellers").select("id, display_name"),
        ])
        if (cancelled) return

        const map: Record<string, string> = {}
        for (const row of (teachersRes.data ?? []) as SubjectOption[]) {
          map[`teacher:${row.id}`] = row.display_name
        }
        for (const row of (sellersRes.data ?? []) as SubjectOption[]) {
          map[`seller:${row.id}`] = row.display_name
        }
        setSubjectNames(map)
      } catch {
        // Name lookup is a display nicety only — silently fall back to the
        // raw subject id shown in the table if it fails.
      }
    }

    loadNames()
    return () => {
      cancelled = true
    }
  }, [state.testimonials])

  const openCreate = () => {
    setEditingTestimonial(null)
    setModalOpen(true)
  }

  const openEdit = (testimonial: TestimonialRecord) => {
    setEditingTestimonial(testimonial)
    setModalOpen(true)
  }

  const handleSaved = () => {
    setModalOpen(false)
    setEditingTestimonial(null)
    load()
  }

  const confirmDelete = async (id: string) => {
    setDeletingId(id)
    setRowError(null)
    try {
      const res = await fetch(`/api/admin/testimonials?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Failed to delete testimonial")
      setPendingDeleteId(null)
      load()
    } catch (e: unknown) {
      setRowError(e instanceof Error ? e.message : "Failed to delete testimonial")
    } finally {
      setDeletingId(null)
    }
  }

  const visibleTestimonials =
    filter === "all" ? state.testimonials : state.testimonials.filter((t) => t.subject_type === filter)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          className={selectClassName}
          value={filter}
          onChange={(e) => setFilter(e.target.value as SubjectFilter)}
          aria-label="Filter testimonials by profile type"
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Button variant="aurora" size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Testimonial
        </Button>
      </div>

      {rowError && (
        <p className="flex items-center gap-2 rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-4 py-2.5 text-sm text-accent-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {rowError}
        </p>
      )}

      {state.loading ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-surface" />
          ))}
        </div>
      ) : state.error ? (
        <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-accent-danger" />
          <p className="mt-3 text-sm text-accent-danger">{state.error}</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={load}>
            Retry
          </Button>
        </div>
      ) : visibleTestimonials.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong bg-surface p-10 text-center">
          <MessageSquareQuote className="mx-auto h-8 w-8 text-text-disabled" />
          <p className="mt-3 text-sm font-medium text-text-primary">No testimonials yet</p>
          <p className="mt-1 text-sm text-text-muted">
            Write one manually, or mark a real quote as imported once you add it here.
          </p>
          <Button variant="secondary" size="sm" className="mt-4 gap-1.5" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Testimonial
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-elevated text-left font-mono text-xs uppercase tracking-[0.08em] text-text-muted">
                  <th className="px-4 py-3 font-medium">Profile</th>
                  <th className="px-4 py-3 font-medium">Author</th>
                  <th className="px-4 py-3 font-medium">Quote</th>
                  <th className="px-4 py-3 font-medium">Rating</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleTestimonials.map((t) => (
                  <tr key={t.id} className="border-b border-border bg-surface last:border-b-0 hover:bg-surface-elevated">
                    <td className="max-w-[160px] px-4 py-3">
                      <p className="truncate font-medium text-text-primary">
                        {subjectNames[`${t.subject_type}:${t.subject_id}`] ?? t.subject_id}
                      </p>
                      <p className="text-xs capitalize text-text-muted">{t.subject_type}</p>
                    </td>
                    <td className="max-w-[140px] px-4 py-3">
                      <p className="truncate text-text-primary">{t.author_name}</p>
                      {t.author_role && <p className="truncate text-xs text-text-muted">{t.author_role}</p>}
                    </td>
                    <td className="max-w-[320px] px-4 py-3 text-text-muted">
                      <p className="line-clamp-2">{t.body}</p>
                    </td>
                    <td className="px-4 py-3">
                      {t.rating ? (
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums text-text-muted">
                          <Star className="h-3.5 w-3.5 fill-accent-warning text-accent-warning" aria-hidden="true" />
                          {t.rating}
                        </span>
                      ) : (
                        <span className="text-text-disabled">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={t.source === "admin" ? "secondary" : "cyan"}>
                        {t.source === "admin" ? "Staff-written" : "Imported"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={t.is_published ? "success" : "outline"}>
                        {t.is_published ? "Published" : "Hidden"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {pendingDeleteId === t.id ? (
                          <>
                            <span className="mr-1 text-xs text-text-muted">Delete?</span>
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-8 w-8"
                              disabled={deletingId === t.id}
                              onClick={() => confirmDelete(t.id)}
                              aria-label="Confirm delete"
                            >
                              {deletingId === t.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={deletingId === t.id}
                              onClick={() => setPendingDeleteId(null)}
                              aria-label="Cancel delete"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(t)}
                              aria-label={`Edit testimonial from ${t.author_name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn("h-8 w-8 text-accent-danger hover:text-accent-danger")}
                              onClick={() => {
                                setRowError(null)
                                setPendingDeleteId(t.id)
                              }}
                              aria-label={`Delete testimonial from ${t.author_name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <TestimonialFormModal
        open={modalOpen}
        testimonial={editingTestimonial}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  )
}
