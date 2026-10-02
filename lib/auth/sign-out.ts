import { createClient } from "@/lib/supabase/client"

/**
 * Signs out and does a FULL navigation to the home page, so every cached
 * server component (greeting, navbar, role-aware pages) is rendered fresh —
 * a client-side router.push can show the previous user's cached page.
 */
export async function signOutAndReload(): Promise<void> {
  try {
    await createClient().auth.signOut()
  } finally {
    window.location.assign("/")
  }
}
