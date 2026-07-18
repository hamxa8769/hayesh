"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ClipboardList, Loader2, RefreshCw, UserPlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils/format"
import { cn } from "@/lib/utils/cn"
import { AssignTeacherModal } from "@/components/admin/AssignTeacherModal"
import type { StudentRequestStatus } from "@/components/parent/student-schema"

export interface AdminStudentRequestRow {
  id: string
  student_id: string
  parent_id: string
  subject: string
  preferred_tier: string | null
  notes: string | null
  status: StudentRequestStatus
  assigned_teacher_id: string | null
  created_at: string | null
  child_name: string
  parent_name: string
  parent_email: string
  teacher_name: string | null
}

const STATUS_TABS: { value: StudentRequestStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "assigned", label: "Assigned" },
  { value: "declined", label: "Declined" },
  { value: "cancelled", label: "Cancelled" },
]

const STATUS_BADGE: Record<StudentRequestStatus, "warning" | "success" | "destructive" | "secondary"> = {
  open: "warning",
  assigned: "success",
  declined: "destructive",
  cancelled: "secondary",
}

interface RawStudentRequestRow {
  id: string
  student_id: string
  parent_id: string
  subject: string
  preferred_tier: string | null
  notes: string | null
  status: StudentRequestStatus
  assigned_teacher_id: string | null
  created_at: string | null
}

export function RequestQueue() {
  const [requests, setRequests] = useState<AdminStudentRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<StudentRequestStatus>("open")
  const [assignTarget, setAssignTarget] = useState<AdminStudentRequestRow | null>(null)
  const [decliningId, setDecliningId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionPendingId, setActionPendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      const { data, error: fetchError } = await supabase
        .from("student_requests")
        .select("*, students(full_name), profiles!parent_id(full_name, email), teachers(display_name)")
        .order("created_at", { ascending: false })

      if (fetchError) {
        // Embed failed (e.g. ambiguous relationship) — fall back to raw rows
        // plus separate lookups rather than ever showing a bare uuid.
        const { data: rawRows, error: rawError } = await supabase
          .from("student_requests")
          .select("*")
          .order("created_at", { ascending: false })

        if (rawError || !rawRows) {
          throw new Error(rawError?.message ?? fetchError.message)
        }

        const rows = rawRows as RawStudentRequestRow[]
        const studentIds = Array.from(new Set(rows.map((r) => r.student_id)))
        const parentIds = Array.from(new Set(rows.map((r) => r.parent_id)))
        const teacherIds = Array.from(
          new Set(rows.map((r) => r.assigned_teacher_id).filter((id): id is string => !!id))
        )

        const [studentsRes, profilesRes, teachersRes] = await Promise.all([
          supabase.from("students").select("id, full_name").in("id", studentIds.length ? studentIds : [""]),
          supabase.from("profiles").select("id, full_name, email").in("id", parentIds.length ? parentIds : [""]),
          supabase.from("teachers").select("id, display_name").in("id", teacherIds.length ? teacherIds : [""]),
        ])

        const studentMap = new Map((studentsRes.data ?? []).map((s) => [s.id as string, s.full_name as string]))
        const profileMap = new Map(
          (profilesRes.data ?? []).map((p) => [p.id as string, { full_name: p.full_name as string, email: p.email as string }])
        )
        const teacherMap = new Map((teachersRes.data ?? []).map((t) => [t.id as string, t.display_name as string]))

        setRequests(
          rows.map((r) => ({
            ...r,
            child_name: studentMap.get(r.student_id) ?? "Unknown student",
            parent_name: profileMap.get(r.parent_id)?.full_name ?? "Unknown parent",
            parent_email: profileMap.get(r.parent_id)?.email ?? "",
            teacher_name: r.assigned_teacher_id ? teacherMap.get(r.assigned_teacher_id) ?? null : null,
          }))
        )
        return
      }

      const rows = (data ?? []) as unknown as Array<
        RawStudentRequestRow & {
          students: { full_name: string } | null
          profiles: { full_name: string; email: string } | null
          teachers: { display_name: string } | null
        }
      >

      setRequests(
        rows.map((r) => ({
          ...r,
          child_name: r.students?.full_name ?? "Unknown student",
          parent_name: r.profiles?.full_name ?? "Unknown parent",
          parent_email: r.profiles?.email ?? "",
          teacher_name: r.teachers?.display_name ?? null,
        }))
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load requests")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => {
    const base: Record<StudentRequestStatus, number> = { open: 0, assigned: 0, declined: 0, cancelled: 0 }
    for (const r of requests) base[r.status] = (base[r.status] ?? 0) + 1
    return base
  }, [requests])

  const filtered = useMemo(() => requests.filter((r) => r.status === activeTab), [requests, activeTab])

  const confirmDecline = async (id: string) => {
    setActionPendingId(id)
    setActionError(null)
    try {
      const res = await fetch("/api/admin/assign-teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: id, action: "decline" }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to decline request")
      }
      setDecliningId(null)
      await load()
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Failed to decline request")
    } finally {
      setActionPendingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "relative flex items-center gap-2 px-3 py-2 font-mono text-xs uppercase tracking-[0.1em] transition-colors",
              activeTab === tab.value ? "text-text-primary" : "text-text-muted hover:text-text-primary"
            )}
          >
            {tab.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                tab.value === "open" && counts.open > 0
                  ? "bg-accent-warning/20 text-accent-warning"
                  : "bg-surface-elevated text-text-muted"
              )}
            >
              {counts[tab.value]}
            </span>
            {activeTab === tab.value && (
              <span className="absolute inset-x-0 -bottom-[5px] h-[2px] [background:linear-gradient(110deg,#27C4A0,#5AD1B0_40%,#F5B84E)]" />
            )}
          </button>
        ))}

        <button
          onClick={() => load()}
          aria-label="Refresh"
          className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-xs text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {actionError && (
        <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-4 py-3 text-sm text-accent-danger">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-surface" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-6 text-center">
          <p className="text-sm text-accent-danger">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => load()}>
            Try again
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-12 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-text-disabled" />
          <p className="mt-3 text-sm text-text-muted">
            {activeTab === "open" ? "No open requests right now" : `No ${activeTab} requests`}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="space-y-3 sm:hidden">
            {filtered.map((r) => (
              <div key={r.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{r.subject}</p>
                    <p className="mt-0.5 truncate text-xs text-text-muted">
                      {r.child_name} &middot; {r.parent_name}
                    </p>
                  </div>
                  <Badge variant={STATUS_BADGE[r.status]}>{r.status}</Badge>
                </div>
                {r.teacher_name && (
                  <p className="mt-2 text-xs text-text-muted">Assigned: {r.teacher_name}</p>
                )}
                <p className="mt-2 font-mono text-xs tabular-nums text-text-muted">
                  {r.created_at ? formatDate(r.created_at) : "—"}
                </p>
                {r.status === "open" && (
                  <div className="mt-3 flex gap-2">
                    <Button variant="aurora" size="sm" onClick={() => setAssignTarget(r)}>
                      <UserPlus className="h-3.5 w-3.5" />
                      Assign
                    </Button>
                    {decliningId === r.id ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={actionPendingId === r.id}
                          onClick={() => confirmDecline(r.id)}
                        >
                          {actionPendingId === r.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          Confirm
                        </Button>
                        <button
                          onClick={() => setDecliningId(null)}
                          aria-label="Cancel decline"
                          className="rounded-md p-1.5 text-text-muted hover:bg-surface-elevated"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => setDecliningId(r.id)}>
                        Decline
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop / tablet: table */}
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface sm:block">
            <div className="min-w-[820px]">
              <div className="grid grid-cols-[1.4fr_1fr_1fr_120px_140px_220px] gap-4 border-b border-border px-4 pb-3 pt-4 font-mono text-xs uppercase tracking-[0.1em] text-text-muted">
                <span>Subject</span>
                <span>Child</span>
                <span>Parent</span>
                <span>Requested</span>
                <span>Status</span>
                <span className="text-right">Action</span>
              </div>
              {filtered.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[1.4fr_1fr_1fr_120px_140px_220px] items-center gap-4 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-elevated"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{r.subject}</p>
                    {r.preferred_tier && <p className="text-xs text-text-muted">{r.preferred_tier}</p>}
                  </div>
                  <p className="truncate text-sm text-text-muted">{r.child_name}</p>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-text-muted">{r.parent_name}</p>
                    {r.teacher_name && <p className="truncate text-xs text-accent-primary">→ {r.teacher_name}</p>}
                  </div>
                  <p className="font-mono text-xs tabular-nums text-text-muted">
                    {r.created_at ? formatDate(r.created_at) : "—"}
                  </p>
                  <Badge variant={STATUS_BADGE[r.status]}>{r.status}</Badge>
                  <div className="flex justify-end gap-2">
                    {r.status === "open" &&
                      (decliningId === r.id ? (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={actionPendingId === r.id}
                            onClick={() => confirmDecline(r.id)}
                          >
                            {actionPendingId === r.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Confirm
                          </Button>
                          <button
                            onClick={() => setDecliningId(null)}
                            aria-label="Cancel decline"
                            className="rounded-md p-1.5 text-text-muted hover:bg-surface"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Button variant="aurora" size="sm" onClick={() => setAssignTarget(r)}>
                            <UserPlus className="h-3.5 w-3.5" />
                            Assign
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setDecliningId(r.id)}>
                            Decline
                          </Button>
                        </>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <AssignTeacherModal
        open={assignTarget !== null}
        request={assignTarget}
        onClose={() => setAssignTarget(null)}
        onAssigned={() => {
          setAssignTarget(null)
          load()
        }}
      />
    </div>
  )
}
