import type { SupabaseClient, User } from "@supabase/supabase-js"

/** What the middleware should do with an admin request. */
export type AdminMfaDecision = "ok" | "challenge" | "setup"

export const MFA_CHALLENGE_PATH = "/auth/mfa"
export const MFA_SETUP_PATH = "/admin/security"

/** True when operators have opted in to forcing 2FA on every admin account. */
export function isAdminMfaRequired(): boolean {
  return process.env.ADMIN_MFA_REQUIRED === "true"
}

/** Does this user (as returned by auth.getUser()) have a verified factor? */
export function hasVerifiedFactor(user: Pick<User, "factors">): boolean {
  return (user.factors ?? []).some((f) => f.status === "verified")
}

/**
 * Decides whether an (already role-checked) admin may proceed.
 *  - verified factor + aal1 session  -> "challenge" (must enter a code)
 *  - no factor + ADMIN_MFA_REQUIRED  -> "setup"
 *  - otherwise                       -> "ok"
 * `user` must come from auth.getUser() (server-verified, includes factors).
 * The session level is read from the JWT, so there is no extra network call.
 * Fails closed: if the level cannot be read, the admin is challenged.
 */
export async function adminMfaDecision(supabase: SupabaseClient, user: Pick<User, "factors">): Promise<AdminMfaDecision> {
  if (hasVerifiedFactor(user)) {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    return !error && data?.currentLevel === "aal2" ? "ok" : "challenge"
  }
  return isAdminMfaRequired() ? "setup" : "ok"
}
