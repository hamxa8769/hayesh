import { createClient } from "@/lib/supabase/server"
import { hasVerifiedFactor } from "@/lib/auth/mfa"
import { MfaBannerDismiss } from "@/components/admin/MfaBannerDismiss"

/**
 * Server component: warns admins who have no two-factor factor yet.
 * Renders nothing when a verified factor exists or the lookup fails.
 * Only mounted under /admin, so non-admins never trigger the lookup.
 */
export async function MfaBanner() {
  try {
    const { data: { user } } = await (await createClient()).auth.getUser()
    if (!user || hasVerifiedFactor(user)) return null
  } catch {
    return null
  }
  return <MfaBannerDismiss />
}
