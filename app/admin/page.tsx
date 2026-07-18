import { redirect } from "next/navigation"

/**
 * Admin portal index.
 *
 * The admin area only defines sub-routes (overview, teachers, sellers,
 * users, payments, ...), so `/admin` itself had no page and returned 404 —
 * which is exactly where post-login role routing, the navbar "Dashboard"
 * link and the auth callback all send an admin. Redirect to the real
 * landing page instead of 404ing.
 */
export default function AdminIndexPage() {
  redirect("/admin/overview")
}
