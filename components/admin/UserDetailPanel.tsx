"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { AlertTriangle, Check, Loader2, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusPill } from "@/components/teacher/StatusPill"
import { cn } from "@/lib/utils/cn"
import type { Profile, UserRole } from "@/types/database"

/**
 * Editable identity fields + the two high-impact account controls (role,
 * is_active). Every write here POSTs to PATCH /api/admin/users — migration
 * 001 revoked UPDATE on profiles.role / profiles.is_active from the
 * `authenticated` role, so a browser-side supabase.update() of those columns
 * is rejected by Postgres before RLS is even consulted. The route also owns
 * the self-demotion and last-active-admin guardrails; their 400 messages are
 * surfaced verbatim next to the control that triggered them.
 */

const ROLES: UserRole[] = ["admin", "teacher", "parent", "seller", "buyer"]

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  teacher: "Teacher",
  parent: "Parent",
  seller: "Seller",
  buyer: "Buyer",
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

export interface UserDetailPanelProps {
  profile: Profile
  currentAdminId: string | null
  onUpdated: (profile: Profile) => void
}

interface PatchResult {
  profile?: Profile
  error?: string
}

async function patchUser(payload: Record<string, unknown>): Promise<Profile> {
  const res = await fetch("/api/admin/users", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const json = (await res.json()) as PatchResult
  if (!res.ok) throw new Error(json.error ?? "Update failed")
  if (!json.profile) throw new Error("The server did not return an updated profile")
  return json.profile
}

export function UserDetailPanel({ profile, currentAdminId, onUpdated }: UserDetailPanelProps) {
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSaved, setProfileSaved] = useState(false)

  const [pendingRole, setPendingRole] = useState<UserRole | null>(null)
  const [roleBusy, setRoleBusy] = useState(false)
  const [roleError, setRoleError] = useState<string | null>(null)

  const [confirmRestrict, setConfirmRestrict] = useState(false)
  const [restrictBusy, setRestrictBusy] = useState(false)
  const [restrictError, setRestrictError] = useState<string | null>(null)

  const isSelf = currentAdminId !== null && currentAdminId === profile.id
  const isRestricted = profile.is_active === false

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      full_name: profile.full_name ?? "",
      email: profile.email ?? "",
      phone: profile.phone ?? "",
      country: profile.country ?? "",
      city: profile.city ?? "",
      bio: profile.bio ?? "",
      is_verified: profile.is_verified === true,
    },
  })

  const onSubmit = async (values: ProfileFormValues) => {
    setProfileError(null)
    setProfileSaved(false)
    try {
      const updated = await patchUser({
        user_id: profile.id,
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
      onUpdated(updated)
      reset(values)
      setProfileSaved(true)
    } catch (e: unknown) {
      setProfileError(e instanceof Error ? e.message : "Could not save changes")
    }
  }

  const applyRole = async (role: UserRole) => {
    setRoleBusy(true)
    setRoleError(null)
    try {
      const updated = await patchUser({ user_id: profile.id, account: { role } })
      onUpdated(updated)
      setPendingRole(null)
    } catch (e: unknown) {
      setRoleError(e instanceof Error ? e.message : "Could not change role")
    } finally {
      setRoleBusy(false)
    }
  }

  const applyRestriction = async (nextActive: boolean) => {
    setRestrictBusy(true)
    setRestrictError(null)
    try {
      const updated = await patchUser({ user_id: profile.id, account: { is_active: nextActive } })
      onUpdated(updated)
      setConfirmRestrict(false)
    } catch (e: unknown) {
      setRestrictError(e instanceof Error ? e.message : "Could not update account access")
    } finally {
      setRestrictBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Identity ─────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-surface p-4 sm:p-6">
        <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Profile details</h2>
        <p className="mt-1 text-sm text-text-muted">Identity fields shown to other users across the platform.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" {...register("full_name")} />
              {errors.full_name && <p className="text-xs text-accent-danger">{errors.full_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-xs text-accent-danger">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register("phone")} placeholder="Not set" />
              {errors.phone && <p className="text-xs text-accent-danger">{errors.phone.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country">Country</Label>
              <Input id="country" {...register("country")} placeholder="Not set" />
              {errors.country && <p className="text-xs text-accent-danger">{errors.country.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" {...register("city")} placeholder="Not set" />
              {errors.city && <p className="text-xs text-accent-danger">{errors.city.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <textarea
              id="bio"
              rows={3}
              {...register("bio")}
              placeholder="No bio provided"
              className="flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
            />
            {errors.bio && <p className="text-xs text-accent-danger">{errors.bio.message}</p>}
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-surface-elevated p-3">
            <input
              id="is_verified"
              type="checkbox"
              {...register("is_verified")}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--color-accent-primary)]"
            />
            <span className="min-w-0">
              <span className="block text-sm text-text-primary">Verified account</span>
              <span className="block text-xs text-text-muted">
                Marks the user as identity-checked. Shown as a badge on their public profile.
              </span>
            </span>
          </label>

          {profileError && (
            <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-sm text-accent-danger">
              {profileError}
            </div>
          )}
          {profileSaved && !isDirty && (
            <p className="flex items-center gap-1.5 text-sm text-accent-success">
              <Check className="h-4 w-4" aria-hidden="true" /> Profile saved.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="aurora" disabled={isSubmitting || !isDirty}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save changes
            </Button>
            {isDirty && (
              <Button type="button" variant="ghost" onClick={() => reset()}>
                Discard
              </Button>
            )}
          </div>
        </form>
      </section>

      {/* ── Role ─────────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-surface p-4 sm:p-6">
        <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Role</h2>
        <p className="mt-1 text-sm text-text-muted">
          Determines which portal and permissions this account has. Changing it takes effect immediately.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {ROLES.map((role) => {
            const isCurrent = profile.role === role
            return (
              <button
                key={role}
                type="button"
                disabled={isCurrent || isSelf || roleBusy}
                onClick={() => {
                  setRoleError(null)
                  setPendingRole(role)
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 font-mono text-xs uppercase tracking-[0.08em] transition-colors",
                  isCurrent
                    ? "border-line-strong bg-surface-elevated text-text-primary"
                    : "border-border text-text-muted hover:border-line-strong hover:text-text-primary",
                  (isSelf || roleBusy) && !isCurrent && "cursor-not-allowed opacity-40"
                )}
              >
                {ROLE_LABEL[role]}
                {isCurrent && " ·  current"}
              </button>
            )
          })}
        </div>

        {isSelf && (
          <p className="mt-3 flex items-start gap-2 text-xs text-text-muted">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            You cannot change your own role. Ask another admin to do it.
          </p>
        )}

        {pendingRole && (
          <div className="mt-4 space-y-3 rounded-lg border border-accent-warning/40 bg-accent-warning/10 p-4">
            <p className="flex items-start gap-2 text-sm text-text-primary">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-warning" aria-hidden="true" />
              <span>
                Change <strong>{profile.full_name || profile.email}</strong> from{" "}
                <strong>{ROLE_LABEL[profile.role]}</strong> to <strong>{ROLE_LABEL[pendingRole]}</strong>? This changes
                what they can access across the whole platform.
              </span>
            </p>
            {roleError && <p className="text-sm text-accent-danger">{roleError}</p>}
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" size="sm" disabled={roleBusy} onClick={() => applyRole(pendingRole)}>
                {roleBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                Yes, change role
              </Button>
              <Button variant="ghost" size="sm" disabled={roleBusy} onClick={() => setPendingRole(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ── Account access ───────────────────────────────────── */}
      <section
        className={cn(
          "rounded-lg border p-4 sm:p-6",
          isRestricted ? "border-accent-danger/40 bg-accent-danger/5" : "border-border bg-surface"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Account access</h2>
            <p className="mt-1 text-sm text-text-muted">
              Restricting an account blocks the user and freezes any withdrawals they have pending review.
            </p>
          </div>
          <StatusPill
            label={isRestricted ? "Restricted" : "Active"}
            tone={isRestricted ? "danger" : "success"}
          />
        </div>

        {restrictError && (
          <div className="mt-3 rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-sm text-accent-danger">
            {restrictError}
          </div>
        )}

        {isSelf ? (
          <p className="mt-4 flex items-start gap-2 text-xs text-text-muted">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            You cannot restrict your own account.
          </p>
        ) : isRestricted ? (
          <Button
            className="mt-4"
            variant="outline"
            disabled={restrictBusy}
            onClick={() => applyRestriction(true)}
          >
            {restrictBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Restore access
          </Button>
        ) : confirmRestrict ? (
          <div className="mt-4 space-y-3 rounded-lg border border-accent-danger/40 bg-accent-danger/10 p-4">
            <p className="flex items-start gap-2 text-sm text-text-primary">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-danger" aria-hidden="true" />
              <span>
                Restrict <strong>{profile.full_name || profile.email}</strong>? They will lose access to their
                dashboard and cannot be paid out until access is restored.
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" size="sm" disabled={restrictBusy} onClick={() => applyRestriction(false)}>
                {restrictBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                Yes, restrict account
              </Button>
              <Button variant="ghost" size="sm" disabled={restrictBusy} onClick={() => setConfirmRestrict(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => {
              setRestrictError(null)
              setConfirmRestrict(true)
            }}
          >
            Restrict account
          </Button>
        )}
      </section>
    </div>
  )
}
