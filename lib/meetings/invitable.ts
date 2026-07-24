import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"

if (typeof window !== "undefined") {
  throw new Error("lib/meetings/invitable.ts must never be imported client-side")
}

/**
 * Computes WHO a meeting host (teacher/seller/admin) may invite.
 *
 * Both exported functions create their own service-role client — figuring
 * out "who has this teacher taught" or "who has this seller sold to" means
 * reading other users' profiles/subscriptions/orders, which the caller's own
 * RLS-scoped session cannot see (RLS on `profiles`, `subscriptions`, etc.
 * only exposes rows the caller owns or is a party to). This mirrors the
 * service-role usage in lib/notifications.ts.
 *
 * Every function here returns an empty result instead of throwing — a host
 * with no eligible invitees yet (e.g. a brand new teacher) is a normal state,
 * not an error.
 */

export interface InvitableUser {
  id: string
  full_name: string | null
  email: string | null
  role: string
}

interface ListInvitableUsersParams {
  inviterId: string
  inviterRole: string
  query?: string
  limit?: number
}

interface FilterInvitableParams {
  inviterId: string
  inviterRole: string
  inviteeIds: string[]
}

interface FilterInvitableResult {
  allowed: string[]
  rejected: string[]
}

const DEFAULT_LIST_LIMIT = 25

/** Strips characters that have special meaning inside a PostgREST `.or()` filter string, so a search query can never inject extra filter clauses. */
function sanitizeFilterValue(value: string): string {
  return value.replace(/[,()%*]/g, "")
}

/** Parents a teacher currently serves: subscription parents plus parents of students assigned to this teacher via student_requests. */
async function getTeacherCandidateIds(admin: SupabaseClient, inviterId: string): Promise<string[]> {
  const { data: teacherRow } = await admin
    .from("teachers")
    .select("id")
    .eq("user_id", inviterId)
    .maybeSingle()

  if (!teacherRow) {
    return []
  }

  const teacherId = (teacherRow as { id: string }).id

  const [subsResult, requestsResult] = await Promise.all([
    admin.from("subscriptions").select("parent_id").eq("teacher_id", teacherId),
    admin.from("student_requests").select("student_id").eq("assigned_teacher_id", teacherId),
  ])

  const parentIds = new Set<string>()

  for (const row of (subsResult.data as Array<{ parent_id: string }> | null) ?? []) {
    parentIds.add(row.parent_id)
  }

  const studentIds = ((requestsResult.data as Array<{ student_id: string }> | null) ?? []).map(
    (row) => row.student_id
  )

  if (studentIds.length > 0) {
    const { data: students } = await admin.from("students").select("parent_id").in("id", studentIds)

    for (const row of (students as Array<{ parent_id: string }> | null) ?? []) {
      parentIds.add(row.parent_id)
    }
  }

  return Array.from(parentIds)
}

/** Buyers who have ordered a gig from this seller. */
async function getSellerCandidateIds(admin: SupabaseClient, inviterId: string): Promise<string[]> {
  const { data: sellerRow } = await admin
    .from("sellers")
    .select("id")
    .eq("user_id", inviterId)
    .maybeSingle()

  if (!sellerRow) {
    return []
  }

  const sellerId = (sellerRow as { id: string }).id

  const { data: orders } = await admin.from("gig_orders").select("buyer_id").eq("seller_id", sellerId)

  const buyerIds = new Set<string>()
  for (const row of (orders as Array<{ buyer_id: string }> | null) ?? []) {
    buyerIds.add(row.buyer_id)
  }

  return Array.from(buyerIds)
}

/**
 * Resolves the candidate profile-id set for a given inviter role.
 * Returns `null` for admin, meaning "unrestricted" — callers must handle
 * that case explicitly rather than treating it as an empty set.
 */
async function getCandidateIds(
  admin: SupabaseClient,
  inviterId: string,
  inviterRole: string
): Promise<string[] | null> {
  if (inviterRole === "admin") {
    return null
  }
  if (inviterRole === "teacher") {
    return getTeacherCandidateIds(admin, inviterId)
  }
  if (inviterRole === "seller") {
    return getSellerCandidateIds(admin, inviterId)
  }
  return []
}

/** Lists users a host may invite, optionally filtered by a name/email search query. */
export async function listInvitableUsers(params: ListInvitableUsersParams): Promise<InvitableUser[]> {
  const { inviterId, inviterRole, query, limit = DEFAULT_LIST_LIMIT } = params
  const admin = createAdminClient()

  const candidateIds = await getCandidateIds(admin, inviterId, inviterRole)

  if (candidateIds !== null && candidateIds.length === 0) {
    return []
  }

  let builder = admin.from("profiles").select("id, full_name, email, role").neq("id", inviterId)

  if (candidateIds !== null) {
    builder = builder.in("id", candidateIds)
  }

  const trimmedQuery = query?.trim()
  if (trimmedQuery) {
    const safeQuery = sanitizeFilterValue(trimmedQuery)
    builder = builder.or(`full_name.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%`)
  }

  const { data, error } = await builder.limit(limit)

  if (error || !data) {
    return []
  }

  return data as InvitableUser[]
}

/** Splits a list of candidate invitee ids into those the host is allowed to invite and those they are not. */
export async function filterInvitable(params: FilterInvitableParams): Promise<FilterInvitableResult> {
  const { inviterId, inviterRole, inviteeIds } = params

  if (inviteeIds.length === 0) {
    return { allowed: [], rejected: [] }
  }

  const admin = createAdminClient()
  const candidateIds = await getCandidateIds(admin, inviterId, inviterRole)

  if (candidateIds === null) {
    // Admin: allowed = every id that is a real profile and isn't the inviter.
    const { data } = await admin.from("profiles").select("id").in("id", inviteeIds)
    const realIds = new Set(((data as Array<{ id: string }> | null) ?? []).map((row) => row.id))

    const allowed: string[] = []
    const rejected: string[] = []
    for (const id of inviteeIds) {
      if (id !== inviterId && realIds.has(id)) {
        allowed.push(id)
      } else {
        rejected.push(id)
      }
    }
    return { allowed, rejected }
  }

  const candidateSet = new Set(candidateIds)
  const allowed: string[] = []
  const rejected: string[] = []
  for (const id of inviteeIds) {
    if (candidateSet.has(id)) {
      allowed.push(id)
    } else {
      rejected.push(id)
    }
  }
  return { allowed, rejected }
}
