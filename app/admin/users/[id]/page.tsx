"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, FileText, Loader2, Star, UserX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/motion/Reveal"
import { UserDetailPanel } from "@/components/admin/UserDetailPanel"
import { StatusPill, statusToneFor, PAYOUT_STATUS_LABEL, type PillTone } from "@/components/teacher/StatusPill"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import type { ApprovalStatus, Payout, Profile, Seller, Teacher } from "@/types/database"

/** teachers.documents — jsonb array of { name, path, kind }. */
interface TeacherDocument {
  name: string
  path: string
  kind: string
}

interface SignedDocument extends TeacherDocument {
  url: string | null
  error: string | null
}

const APPROVAL_TONE: Record<ApprovalStatus, PillTone> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  suspended: "danger",
}

/** Narrows an unknown jsonb value into the document shape without using `any`. */
function parseDocuments(value: unknown): TeacherDocument[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return []
    const record = entry as Record<string, unknown>
    const { name, path, kind } = record
    if (typeof path !== "string" || path.length === 0) return []
    return [
      {
        path,
        name: typeof name === "string" && name ? name : path.split("/").pop() ?? "Document",
        kind: typeof kind === "string" && kind ? kind : "document",
      },
    ]
  })
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-xs uppercase tracking-[0.1em] text-text-muted">{label}</p>
      <p className="mt-1 break-words text-sm tabular-nums text-text-primary">{value}</p>
    </div>
  )
}

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>()
  const userId = params.id

  const [profile, setProfile] = useState<Profile | null>(null)
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [seller, setSeller] = useState<Seller | null>(null)
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [documents, setDocuments] = useState<SignedDocument[]>([])
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      setCurrentAdminId(authUser?.id ?? null)

      // .maybeSingle(), never .single() — a missing row must be a null, not a 406.
      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle()

      if (profileError) throw new Error(profileError.message)
      if (!profileRow) {
        setProfile(null)
        return
      }
      setProfile(profileRow as Profile)

      const [teacherRes, sellerRes, payoutRes] = await Promise.all([
        supabase.from("teachers").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("sellers").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("payouts").select("*").eq("recipient_id", userId).order("created_at", { ascending: false }),
      ])

      const teacherRow = (teacherRes.data ?? null) as Teacher | null
      setTeacher(teacherRow)
      setSeller((sellerRes.data ?? null) as Seller | null)
      setPayouts((payoutRes.data ?? []) as Payout[])

      // teacher-documents is a PRIVATE bucket (migration 009) — a public URL
      // would 404. Admins are allowed to read every object in it, so we mint a
      // short-lived signed URL per document instead.
      const docs = parseDocuments((teacherRow as { documents?: unknown } | null)?.documents)
      if (docs.length === 0) {
        setDocuments([])
      } else {
        const signed = await Promise.all(
          docs.map(async (doc): Promise<SignedDocument> => {
            const { data, error: signError } = await supabase.storage
              .from("teacher-documents")
              .createSignedUrl(doc.path, 300)
            if (signError || !data?.signedUrl) {
              return { ...doc, url: null, error: signError?.message ?? "Could not generate a view link" }
            }
            return { ...doc, url: data.signedUrl, error: null }
          })
        )
        setDocuments(signed)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load this user")
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  /** All privileged writes go through the admin route — never the browser client. */
  const runAction = async (payload: Record<string, unknown>) => {
    setActionBusy(true)
    setActionError(null)
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, ...payload }),
      })
      const json = (await res.json()) as { teacher?: Teacher; seller?: Seller; error?: string }
      if (!res.ok) throw new Error(json.error ?? "Action failed")
      if (json.teacher) setTeacher(json.teacher)
      if (json.seller) setSeller(json.seller)
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Action failed")
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <Reveal>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to all users
        </Link>
        <p className="mt-3 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Admin / Users / Detail</p>
        <h1 className="mt-1 break-words font-display text-2xl font-semibold text-text-primary sm:text-3xl">
          {loading ? "Loading user…" : profile?.full_name || profile?.email || "User"}
        </h1>
        {profile && <p className="mt-1 break-all font-mono text-xs text-text-muted">{profile.id}</p>}
      </Reveal>

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg border border-border bg-surface" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-6 text-center">
          <p className="text-sm text-accent-danger">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={load}>
            Try again
          </Button>
        </div>
      ) : !profile ? (
        <div className="rounded-lg border border-border bg-surface p-12 text-center">
          <UserX className="mx-auto h-10 w-10 text-text-disabled" aria-hidden="true" />
          <p className="mt-3 text-sm text-text-primary">This user no longer exists</p>
          <p className="mt-1 text-xs text-text-muted">They may have been deleted since the list was loaded.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {actionError && (
            <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-4 py-3 text-sm text-accent-danger">
              {actionError}
            </div>
          )}

          <UserDetailPanel
            profile={profile}
            currentAdminId={currentAdminId}
            onUpdated={(updated) => setProfile(updated)}
          />

          {/* ── Teacher record ─────────────────────────────── */}
          {teacher && (
            <section className="rounded-lg border border-border bg-surface p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Teacher record</h2>
                  <p className="mt-1 truncate text-sm text-text-primary">{teacher.display_name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill
                    label={teacher.status ?? "pending"}
                    tone={APPROVAL_TONE[teacher.status ?? "pending"]}
                  />
                  {teacher.featured && <StatusPill label="Featured" tone="info" />}
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Group / mo" value={teacher.group_price_pkr ? formatCurrency(teacher.group_price_pkr, "PKR") : "—"} />
                <Field label="Standard / mo" value={teacher.standard_price_pkr ? formatCurrency(teacher.standard_price_pkr, "PKR") : "—"} />
                <Field label="Private / mo" value={teacher.private_price_pkr ? formatCurrency(teacher.private_price_pkr, "PKR") : "—"} />
                <Field
                  label="Rating"
                  value={`${(teacher.average_rating ?? 0).toFixed(2)} (${teacher.total_reviews ?? 0} reviews)`}
                />
              </div>

              <div className="mt-4">
                <p className="font-mono text-xs uppercase tracking-[0.1em] text-text-muted">Subjects</p>
                {teacher.subjects && teacher.subjects.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {teacher.subjects.map((s, i) => (
                      <span
                        key={`${s.subject}-${i}`}
                        className="rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-text-primary"
                      >
                        {s.subject}
                        <span className="ml-1.5 text-text-muted">{s.level}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-text-muted">No subjects listed yet.</p>
                )}
              </div>

              <div className="mt-4">
                <p className="font-mono text-xs uppercase tracking-[0.1em] text-text-muted">Availability</p>
                {teacher.availability && Object.keys(teacher.availability).length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(teacher.availability).map(([day, slots]) => (
                      <span
                        key={day}
                        className="rounded-md border border-border bg-surface-elevated px-2.5 py-1 font-mono text-xs text-text-muted"
                      >
                        <span className="uppercase text-text-primary">{day}</span> {(slots ?? []).join(", ") || "—"}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-text-muted">No availability set.</p>
                )}
              </div>

              <div className="mt-4">
                <p className="font-mono text-xs uppercase tracking-[0.1em] text-text-muted">Uploaded documents</p>
                {documents.length === 0 ? (
                  <p className="mt-1 text-sm text-text-muted">This teacher has not uploaded any documents.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {documents.map((doc) => (
                      <li
                        key={doc.path}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-elevated px-3 py-2"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-text-primary">{doc.name}</span>
                            <span className="block font-mono text-xs uppercase text-text-muted">{doc.kind}</span>
                          </span>
                        </span>
                        {doc.url ? (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-xs text-accent-primary underline-offset-4 hover:underline"
                          >
                            View document
                          </a>
                        ) : (
                          <span className="shrink-0 text-xs text-accent-danger">{doc.error}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {teacher.status !== "approved" && (
                  <Button
                    variant="aurora"
                    size="sm"
                    disabled={actionBusy}
                    onClick={() => runAction({ teacher: { id: teacher.id, status: "approved" } })}
                  >
                    {actionBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                    Approve teacher
                  </Button>
                )}
                {teacher.status !== "rejected" && (
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={actionBusy}
                    onClick={() => runAction({ teacher: { id: teacher.id, status: "rejected" } })}
                  >
                    Reject
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={actionBusy}
                  onClick={() => runAction({ teacher: { id: teacher.id, featured: !teacher.featured } })}
                >
                  <Star className="h-3.5 w-3.5" aria-hidden="true" />
                  {teacher.featured ? "Remove from featured" : "Feature this teacher"}
                </Button>
              </div>
            </section>
          )}

          {/* ── Seller record ──────────────────────────────── */}
          {seller && (
            <section className="rounded-lg border border-border bg-surface p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Seller record</h2>
                  <p className="mt-1 truncate text-sm text-text-primary">{seller.display_name}</p>
                </div>
                <StatusPill label={seller.status ?? "pending"} tone={APPROVAL_TONE[seller.status ?? "pending"]} />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Level" value={seller.level ?? "new"} />
                <Field label="Orders" value={String(seller.total_orders ?? 0)} />
                <Field label="Completed" value={String(seller.completed_orders ?? 0)} />
                <Field
                  label="Rating"
                  value={`${(seller.average_rating ?? 0).toFixed(2)} (${seller.total_reviews ?? 0})`}
                />
              </div>

              {seller.skills && seller.skills.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {seller.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-text-primary"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                {seller.status !== "approved" && (
                  <Button
                    variant="aurora"
                    size="sm"
                    disabled={actionBusy}
                    onClick={() => runAction({ seller: { id: seller.id, status: "approved" } })}
                  >
                    {actionBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                    Approve seller
                  </Button>
                )}
                {seller.status !== "rejected" && (
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={actionBusy}
                    onClick={() => runAction({ seller: { id: seller.id, status: "rejected" } })}
                  >
                    Reject
                  </Button>
                )}
              </div>
            </section>
          )}

          {/* ── Withdrawal activity ────────────────────────── */}
          <section className="rounded-lg border border-border bg-surface p-4 sm:p-6">
            <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Withdrawal activity</h2>
            <p className="mt-1 text-sm text-text-muted">
              Payout requests made by this user. Bank details are encrypted at rest and are never shown here.
            </p>

            {payouts.length === 0 ? (
              <p className="mt-4 text-sm text-text-muted">This user has never requested a withdrawal.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <div className="min-w-[520px] divide-y divide-border">
                  <div className="grid grid-cols-[130px_1fr_130px_120px] gap-4 pb-2 font-mono text-xs uppercase tracking-[0.1em] text-text-muted">
                    <span>Requested</span>
                    <span>Bank / account</span>
                    <span className="text-right">Amount</span>
                    <span className="text-right">Status</span>
                  </div>
                  {payouts.map((p) => (
                    <div key={p.id} className="grid grid-cols-[130px_1fr_130px_120px] items-center gap-4 py-3">
                      <span className="font-mono text-xs tabular-nums text-text-muted">
                        {p.created_at ? formatDate(p.created_at) : "—"}
                      </span>
                      <span className="min-w-0 truncate text-sm text-text-primary">
                        {p.bank_name || "—"}
                        <span className="ml-2 font-mono text-xs text-text-muted">•••• (encrypted)</span>
                      </span>
                      <span className="text-right font-mono text-sm font-semibold tabular-nums text-text-primary">
                        {formatCurrency(p.amount || 0, p.currency === "USD" ? "USD" : "PKR")}
                      </span>
                      <span className="flex justify-end">
                        <StatusPill
                          label={PAYOUT_STATUS_LABEL[p.status ?? "pending"] ?? "Pending"}
                          tone={statusToneFor(p.status)}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
