import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Profile, Teacher, Seller } from "@/types/database"

/**
 * PATCH /api/admin/users
 *
 * The super-admin "edit everything" surface. Handles four independent
 * concerns in one call (a caller sends only the sections it wants changed):
 *
 *   - profile: identity fields (full_name, email, phone, country, city, bio,
 *     is_verified)
 *   - account: role and is_active — THE privileged columns. Migration 001
 *     revoked UPDATE on these from `authenticated` entirely, and there is no
 *     "admin can update any profile row" RLS policy either (only "Admin can
 *     view all profiles" for SELECT) — so even a plain field like full_name
 *     on ANOTHER user's row is unreachable from the browser client. Every
 *     write in this route therefore goes through createAdminClient()
 *     (service role), after re-verifying the caller is an admin from the
 *     database — never from anything the client sent.
 *   - teacher: approval status + featured flag on the user's teachers row
 *   - seller: approval status on the user's sellers row
 *
 * GUARDRAILS (see inline comments below):
 *   1. An admin can never demote or deactivate their own account.
 *   2. The last active admin account can never be demoted or deactivated —
 *      that would permanently lock the platform out of its only admin.
 */

const ROLE_VALUES = ["admin", "teacher", "parent", "seller", "buyer"] as const
const APPROVAL_STATUS_VALUES = ["pending", "approved", "rejected", "suspended"] as const

const profileUpdateSchema = z.object({
  full_name: z.string().trim().min(1, "Name cannot be empty").max(200).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email").optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  country: z.string().trim().max(80).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  is_verified: z.boolean().optional(),
})

const accountUpdateSchema = z.object({
  role: z.enum(ROLE_VALUES).optional(),
  is_active: z.boolean().optional(),
})

const teacherActionSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(APPROVAL_STATUS_VALUES).optional(),
  featured: z.boolean().optional(),
})

const sellerActionSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(APPROVAL_STATUS_VALUES).optional(),
})

const patchUserSchema = z.object({
  user_id: z.string().uuid(),
  profile: profileUpdateSchema.optional(),
  account: accountUpdateSchema.optional(),
  teacher: teacherActionSchema.optional(),
  seller: sellerActionSchema.optional(),
})

interface UserErrorResponse {
  error: string
}

interface UserPatchResponse {
  profile?: Profile
  teacher?: Teacher
  seller?: Seller
}

async function requireAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse<UserErrorResponse> }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.role !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "Admin access required" }, { status: 403 }) }
  }

  return { ok: true, userId: user.id }
}

/** Strips `undefined` entries so a Supabase `.update()` only touches fields the caller actually sent. */
function withoutUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {}
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) result[key] = obj[key]
  }
  return result
}

export async function PATCH(
  request: Request
): Promise<NextResponse<UserPatchResponse | UserErrorResponse>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = patchUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }

  const { user_id, profile, account, teacher, seller } = parsed.data

  const profileChanges = withoutUndefined(profile ?? {})
  const accountChanges = withoutUndefined(account ?? {})
  const teacherChanges = teacher ? withoutUndefined({ status: teacher.status, featured: teacher.featured }) : {}
  const sellerChanges = seller ? withoutUndefined({ status: seller.status }) : {}

  const hasProfileChanges = Object.keys(profileChanges).length > 0
  const hasAccountChanges = Object.keys(accountChanges).length > 0
  const hasTeacherChanges = Object.keys(teacherChanges).length > 0
  const hasSellerChanges = Object.keys(sellerChanges).length > 0

  if (!hasProfileChanges && !hasAccountChanges && !hasTeacherChanges && !hasSellerChanges) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  const adminClient = createAdminClient()

  const { data: targetProfile, error: targetError } = await adminClient
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user_id)
    .maybeSingle()

  if (targetError) {
    return NextResponse.json({ error: targetError.message }, { status: 400 })
  }
  if (!targetProfile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  // ── GUARDRAIL 1: no self-demotion / self-deactivation ────────────────
  // An admin editing their own row through this panel can never change
  // their own role or flip themselves inactive — either would risk locking
  // the caller (and potentially the whole platform, see guardrail 2) out.
  if (user_id === auth.userId) {
    if (accountChanges.role !== undefined) {
      return NextResponse.json({ error: "You cannot change your own role." }, { status: 400 })
    }
    if (accountChanges.is_active === false) {
      return NextResponse.json({ error: "You cannot deactivate your own account." }, { status: 400 })
    }
  }

  // ── GUARDRAIL 2: never remove the last active admin ──────────────────
  // If this change would take an admin out of the admin role or mark them
  // inactive, confirm at least one OTHER active admin still exists first.
  const targetIsAdmin = targetProfile.role === "admin"
  const wouldLoseAdminRole = targetIsAdmin && accountChanges.role !== undefined && accountChanges.role !== "admin"
  const wouldBeDeactivated = targetIsAdmin && accountChanges.is_active === false

  if (wouldLoseAdminRole || wouldBeDeactivated) {
    const { count, error: countError } = await adminClient
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .neq("id", user_id)
      .or("is_active.is.null,is_active.eq.true")

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 400 })
    }
    if (!count || count === 0) {
      return NextResponse.json(
        {
          error:
            "This is the last active admin account. Promote another admin before changing this one, or the platform will have no admin left.",
        },
        { status: 400 }
      )
    }
  }

  const response: UserPatchResponse = {}

  if (hasProfileChanges || hasAccountChanges) {
    const { data: updatedProfile, error: profileUpdateError } = await adminClient
      .from("profiles")
      .update({ ...profileChanges, ...accountChanges })
      .eq("id", user_id)
      .select("*")
      .maybeSingle()

    if (profileUpdateError) {
      return NextResponse.json({ error: profileUpdateError.message }, { status: 400 })
    }
    if (updatedProfile) response.profile = updatedProfile as Profile
  }

  if (hasTeacherChanges && teacher) {
    const { data: updatedTeacher, error: teacherUpdateError } = await adminClient
      .from("teachers")
      .update(teacherChanges)
      .eq("id", teacher.id)
      .eq("user_id", user_id)
      .select("*")
      .maybeSingle()

    if (teacherUpdateError) {
      return NextResponse.json({ error: teacherUpdateError.message }, { status: 400 })
    }
    if (!updatedTeacher) {
      return NextResponse.json({ error: "Teacher record not found for this user" }, { status: 404 })
    }
    response.teacher = updatedTeacher as Teacher
  }

  if (hasSellerChanges && seller) {
    const { data: updatedSeller, error: sellerUpdateError } = await adminClient
      .from("sellers")
      .update(sellerChanges)
      .eq("id", seller.id)
      .eq("user_id", user_id)
      .select("*")
      .maybeSingle()

    if (sellerUpdateError) {
      return NextResponse.json({ error: sellerUpdateError.message }, { status: 400 })
    }
    if (!updatedSeller) {
      return NextResponse.json({ error: "Seller record not found for this user" }, { status: 404 })
    }
    response.seller = updatedSeller as Seller
  }

  return NextResponse.json(response)
}
