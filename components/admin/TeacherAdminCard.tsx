"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Loader2,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  Star,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusPill, type PillTone } from "@/components/teacher/StatusPill"
import { formatDate } from "@/lib/utils/format"
import { cn } from "@/lib/utils/cn"
import type { ApprovalStatus, Profile, Teacher } from "@/types/database"

/**
 * Single teacher row. Every privileged write goes through PATCH
 * /api/admin/users (service role, admin-checked server-side) — migration 001
 * revoked UPDATE on teachers.status/featured and profiles.role/is_active from
 * the `authenticated` role, so a browser-side supabase.update() of any of
 * those columns is rejected by Postgres before RLS is even consulted.
 *
 * There is NO 'suspended' value in the approval_status enum (only
 * 'pending' | 'approved' | 'rejected'). "Suspend" here means
 * profiles.is_active = false — a platform-wide account lock, not a teacher
 * status. "Active"/"Suspended" pills below are derived from that column.
 */

const APPROVAL_TONE: Record<ApprovalStatus, PillTone> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  // Unused for writes (DB enum has no 'suspended' value) — kept only
  // because ApprovalStatus is the shared type and must stay exhaustive.
  suspended: "danger",
}

const profileFormSchema = z.object({
  full_name: z.string().trim().min(1, "Name cannot be empty").max(200),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().max(40),
  country: z.string().trim().max(80),
  city: z.string().trim().max(80),
  bio: z.string().trim().max(2000),
  is_verified: z.boolean(),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

export interface TeacherAdminCardProps {
  teacher: Teacher
  profile: Profile | null
  onTeacherUpdated: (teacher: Teacher) => void
  onProfileUpdated: (profile: Profile) => void
}

interface PatchResult {
  profile?: Profile
  teacher?: Teacher
  error?: string
}

async function patchUser(payload: Record<string, unknown>): Promise<PatchResult> {
  const res = await fetch("/api/admin/users", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const json = (await res.json()) as PatchResult
  if (!res.ok) throw new Error(json.error ?? "Action failed")
  return json
}

type ActionKey = "approve" | "reject" | "feature" | "suspend" | "activate"
type ConfirmState = { key: Extract<ActionKey, "reject" | "suspend">; label: string } | null

export function TeacherAdminCard({ teacher, profile, onTeacherUpdated, onProfileUpdated }: TeacherAdminCardProps) {
  const [busyKey, setBusyKey] = useState<ActionKey | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaved, setEditSaved] = useState(false)

  const isSuspended = profile?.is_active === false
  const status = teacher.status ?? "pending"

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      full_name: profile?.full_name ?? "",
      email: profile?.email ?? "",
      phone: profile?.phone ?? "",
      country: profile?.country ?? "",
      city: profile?.city ?? "",
      bio: profile?.bio ?? "",
      is_verified: profile?.is_verified === true,
    },
  })

  const runTeacherAction = async (key: ActionKey, nextStatus?: ApprovalStatus, featured?: boolean) => {
    setBusyKey(key)
    setActionError(null)
    try {
      const result = await patchUser({
        user_id: teacher.user_id,
        teacher: {
          id: teacher.id,
          ...(nextStatus ? { status: nextStatus } : {}),
          ...(featured !== undefined ? { featured } : {}),
        },
      })
      if (result.teacher) onTeacherUpdated(result.teacher)
      setConfirm(null)
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Action failed")
    } finally {
      setBusyKey(null)
    }
  }

  const runAccountAction = async (key: ActionKey, isActive: boolean) => {
    setBusyKey(key)
    setActionError(null)
    try {
      const result = await patchUser({ user_id: teacher.user_id, account: { is_active: isActive } })
      if (result.profile) onProfileUpdated(result.profile)
      setConfirm(null)
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Action failed")
    } finally {
      setBusyKey(null)
    }
  }

  const onSubmitEdit = async (values: ProfileFormValues) => {
    setEditError(null)
    setEditSaved(false)
    try {
      const result = await patchUser({
        user_id: teacher.user_id,
        profile: {
          full_name: values.full_name,
          email: values.email,
          phone: values.phone || null,
          country: values.country || null,
          city: values.city || null,
          bio: values.bio || null,
          is_verified: values.is_verified,
        },
      })
      if (result.profile) {
        onProfileUpdated(result.profile)
        reset(values)
        setEditSaved(true)
      }
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Could not save changes")
    }
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-surface p-4 sm:p-5",
        isSuspended ? "border-accent-danger/30" : "border-border"
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-text-primary">
              {teacher.display_name || "Unnamed teacher"}
            </p>
            <StatusPill label={status} tone={APPROVAL_TONE[status]} />
            <StatusPill label={isSuspended ? "Suspended" : "Active"} tone={isSuspended ? "danger" : "success"} />
            {teacher.featured && <StatusPill label="Featured" tone="info" />}
          </div>
          <p className="mt-1 truncate font-mono text-xs text-text-muted">{profile?.email ?? "No linked profile"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-text-muted">
            <span>Joined {teacher.created_at ? formatDate(teacher.created_at) : "—"}</span>
            <span className="tabular-nums">
              ★ {(teacher.average_rating ?? 0).toFixed(1)} ({teacher.total_reviews ?? 0} reviews)
            </span>
          </div>
          {teacher.subjects && teacher.subjects.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {teacher.subjects.slice(0, 4).map((s, i) => (
                <span
                  key={`${s.subject}-${i}`}
                  className="rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-xs text-text-muted"
                >
                  {s.subject}
                </span>
              ))}
              {teacher.subjects.length > 4 && (
                <span className="rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-xs text-text-muted">
                  +{teacher.subjects.length - 4} more
                </span>
              )}
            </div>
          )}
        </div>

        <Link
          href={`/admin/users/${teacher.user_id}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-line-strong hover:text-text-primary"
        >
          View full details
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {actionError && (
        <div className="mt-3 rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-sm text-accent-danger">
          {actionError}
        </div>
      )}

      {confirm && (
        <div className="mt-3 space-y-2 rounded-lg border border-accent-danger/40 bg-accent-danger/10 p-3">
          <p className="flex items-start gap-2 text-sm text-text-primary">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-danger" aria-hidden="true" />
            {confirm.label}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={busyKey !== null}
              onClick={() =>
                confirm.key === "reject" ? runTeacherAction("reject", "rejected") : runAccountAction("suspend", false)
              }
            >
              {busyKey === confirm.key && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Yes, {confirm.key}
            </Button>
            <Button variant="ghost" size="sm" disabled={busyKey !== null} onClick={() => setConfirm(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        {(status === "pending" || status === "rejected") && (
          <Button
            variant="aurora"
            size="sm"
            disabled={busyKey !== null}
            onClick={() => runTeacherAction("approve", "approved")}
          >
            {busyKey === "approve" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            Approve
          </Button>
        )}
        {(status === "pending" || status === "approved") && (
          <Button
            variant="outline"
            size="sm"
            className="border-accent-danger/40 text-accent-danger hover:border-accent-danger/60 hover:bg-accent-danger/10"
            disabled={busyKey !== null}
            onClick={() =>
              setConfirm({
                key: "reject",
                label: `Reject ${teacher.display_name || "this teacher"}? They will lose approved status and disappear from teacher search results.`,
              })
            }
          >
            Reject
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={busyKey !== null}
          onClick={() => runTeacherAction("feature", undefined, !teacher.featured)}
        >
          <Star className="h-3.5 w-3.5" aria-hidden="true" />
          {busyKey === "feature" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          {teacher.featured ? "Unfeature" : "Feature"}
        </Button>
        {profile &&
          (isSuspended ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busyKey !== null}
              onClick={() => runAccountAction("activate", true)}
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {busyKey === "activate" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Activate
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="border-accent-danger/40 text-accent-danger hover:border-accent-danger/60 hover:bg-accent-danger/10"
              disabled={busyKey !== null}
              onClick={() =>
                setConfirm({
                  key: "suspend",
                  label: `Suspend ${profile.full_name || profile.email}? This deactivates their account platform-wide — they will lose dashboard access immediately.`,
                })
              }
            >
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              Suspend
            </Button>
          ))}
        {profile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsEditing((v) => !v)
              setEditError(null)
              setEditSaved(false)
            }}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            {isEditing ? "Close edit" : "Edit profile"}
          </Button>
        )}
      </div>

      {!profile && (
        <p className="mt-3 text-xs text-accent-warning">
          No linked profile record found for this teacher — account actions are unavailable.
        </p>
      )}

      {isEditing && profile && (
        <form
          onSubmit={handleSubmit(onSubmitEdit)}
          className="mt-4 space-y-3 rounded-lg border border-line-strong bg-surface-elevated p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`name-${teacher.id}`}>Full name</Label>
              <Input id={`name-${teacher.id}`} {...register("full_name")} />
              {errors.full_name && <p className="text-xs text-accent-danger">{errors.full_name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor={`email-${teacher.id}`}>Email</Label>
              <Input id={`email-${teacher.id}`} type="email" {...register("email")} />
              {errors.email && <p className="text-xs text-accent-danger">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor={`phone-${teacher.id}`}>Phone</Label>
              <Input id={`phone-${teacher.id}`} {...register("phone")} placeholder="Not set" />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`city-${teacher.id}`}>City</Label>
              <Input id={`city-${teacher.id}`} {...register("city")} placeholder="Not set" />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`country-${teacher.id}`}>Country</Label>
              <Input id={`country-${teacher.id}`} {...register("country")} placeholder="Not set" />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor={`bio-${teacher.id}`}>Bio</Label>
            <textarea
              id={`bio-${teacher.id}`}
              rows={2}
              {...register("bio")}
              placeholder="No bio provided"
              className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              {...register("is_verified")}
              className="h-4 w-4 accent-[color:var(--color-accent-primary)]"
            />
            Verified account
          </label>

          {editError && <p className="text-sm text-accent-danger">{editError}</p>}
          {editSaved && !isDirty && (
            <p className="flex items-center gap-1.5 text-sm text-accent-success">
              <Check className="h-4 w-4" aria-hidden="true" /> Saved.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="aurora" size="sm" disabled={isSubmitting || !isDirty}>
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Save changes
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                reset()
                setIsEditing(false)
              }}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
