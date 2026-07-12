import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const ALLOWED_ROLES = ["teacher", "parent", "seller", "buyer"] as const

// Returns the signed-in user's profile, self-healing a missing row.
// Uses the service-role admin client so RLS / a failed signup trigger can't
// make this 500 (which used to break post-login role routing — the login
// page calls this to decide which dashboard to send the user to).
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ profile: existing })
  }

  // No profile row yet (signup trigger failed, or a legacy account) — create
  // one from the auth metadata so the user can be routed to their dashboard.
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const rawRole = typeof meta.role === "string" ? meta.role : ""
  const role = (ALLOWED_ROLES as readonly string[]).includes(rawRole) ? rawRole : "buyer"
  const fullName =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    user.email?.split("@")[0] ||
    "New user"

  const { data: created, error: createError } = await admin
    .from("profiles")
    .upsert(
      { id: user.id, role, full_name: fullName, email: user.email ?? "" },
      { onConflict: "id" }
    )
    .select("*")
    .maybeSingle()

  if (createError) {
    // Last resort: hand back a minimal profile so routing still works.
    return NextResponse.json({ profile: { id: user.id, role, full_name: fullName, email: user.email ?? "" } })
  }

  return NextResponse.json({ profile: created })
}
