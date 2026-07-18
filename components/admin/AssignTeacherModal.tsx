"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Loader2, Search, Sparkles, UserPlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils/cn"
import type { AdminStudentRequestRow } from "@/components/admin/RequestQueue"
import type { SubjectEntry } from "@/types/database"

export interface AssignTeacherModalProps {
  open: boolean
  request: AdminStudentRequestRow | null
  onClose: () => void
  onAssigned: () => void
}

interface ApprovedTeacherRow {
  id: string
  display_name: string
  subjects: SubjectEntry[] | null
  average_rating: number | null
}

function subjectMatches(subjects: SubjectEntry[] | null, requestedSubject: string): boolean {
  if (!subjects || subjects.length === 0) return false
  const needle = requestedSubject.trim().toLowerCase()
  if (!needle) return false
  return subjects.some((s) => {
    const hay = s.subject.trim().toLowerCase()
    return hay === needle || hay.includes(needle) || needle.includes(hay)
  })
}

export function AssignTeacherModal({ open, request, onClose, onAssigned }: AssignTeacherModalProps) {
  const prefersReducedMotion = useReducedMotion()
  const dialogRef = useRef<HTMLDivElement>(null)

  const [teachers, setTeachers] = useState<ApprovedTeacherRow[]>([])
  const [loadingTeachers, setLoadingTeachers] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const submittingRef = useRef(submitting)

  useEffect(() => {
    submittingRef.current = submitting
  }, [submitting])

  useEffect(() => {
    if (!open) return
    setSearch("")
    setSelectedTeacherId(null)
    setSubmitError(null)

    let cancelled = false
    const loadTeachers = async () => {
      setLoadingTeachers(true)
      setLoadError(null)
      try {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        const { data, error } = await supabase
          .from("teachers")
          .select("id, display_name, subjects, average_rating")
          .eq("status", "approved")
          .order("display_name", { ascending: true })

        if (error) throw new Error(error.message)
        if (!cancelled) setTeachers((data ?? []) as ApprovedTeacherRow[])
      } catch (e: unknown) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load teachers")
      } finally {
        if (!cancelled) setLoadingTeachers(false)
      }
    }

    loadTeachers()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("#assign-teacher-search")?.focus()
    })
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submittingRef.current) {
        onClose()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("keydown", onKeyDown)
      previouslyFocused?.focus()
    }
  }, [open, onClose])

  const sortedTeachers = useMemo(() => {
    const query = search.trim().toLowerCase()
    const withMatch = teachers
      .filter((t) => !query || t.display_name.toLowerCase().includes(query))
      .map((t) => ({
        teacher: t,
        matches: request ? subjectMatches(t.subjects, request.subject) : false,
      }))

    withMatch.sort((a, b) => {
      if (a.matches !== b.matches) return a.matches ? -1 : 1
      return a.teacher.display_name.localeCompare(b.teacher.display_name)
    })

    return withMatch
  }, [teachers, search, request])

  const close = () => {
    if (submitting) return
    setSubmitError(null)
    onClose()
  }

  const submit = async () => {
    if (!request || !selectedTeacherId) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch("/api/admin/assign-teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: request.id, teacher_id: selectedTeacherId, action: "assign" }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to assign teacher")
      }
      onAssigned()
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && request && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.button
            aria-hidden="true"
            tabIndex={-1}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="assign-teacher-title"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="glass relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-accent-primary" />
                <h2 id="assign-teacher-title" className="font-display text-lg font-semibold text-text-primary">
                  Assign a Teacher
                </h2>
              </div>
              <button
                onClick={close}
                aria-label="Close"
                className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 text-sm text-text-muted">
              Request: <span className="text-text-primary">{request.subject}</span> for {request.child_name}
            </p>

            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                id="assign-teacher-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search approved teachers"
                className="pl-9"
              />
            </div>

            <div className="mt-3 flex-1 overflow-y-auto rounded-lg border border-border">
              {loadingTeachers ? (
                <div className="space-y-2 p-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-md bg-surface-elevated" />
                  ))}
                </div>
              ) : loadError ? (
                <p className="p-4 text-sm text-accent-danger">{loadError}</p>
              ) : sortedTeachers.length === 0 ? (
                <p className="p-4 text-sm text-text-muted">No approved teachers match your search.</p>
              ) : (
                <ul>
                  {sortedTeachers.map(({ teacher, matches }) => (
                    <li key={teacher.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedTeacherId(teacher.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-elevated",
                          selectedTeacherId === teacher.id && "bg-surface-elevated"
                        )}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text-primary">{teacher.display_name}</p>
                          {teacher.subjects && teacher.subjects.length > 0 && (
                            <p className="truncate text-xs text-text-muted">
                              {teacher.subjects.map((s) => s.subject).join(", ")}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {matches && (
                            <Badge variant="success" className="gap-1">
                              <Sparkles className="h-3 w-3" />
                              Match
                            </Badge>
                          )}
                          <div
                            className={cn(
                              "h-4 w-4 shrink-0 rounded-full border-2",
                              selectedTeacherId === teacher.id
                                ? "border-accent-primary bg-accent-primary"
                                : "border-border"
                            )}
                          />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {submitError && <p className="mt-3 text-sm text-accent-danger">{submitError}</p>}

            <div className="mt-4 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={close} disabled={submitting}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="aurora"
                disabled={submitting || !selectedTeacherId}
                onClick={submit}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Assign Teacher
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
