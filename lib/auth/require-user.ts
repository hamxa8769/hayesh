import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import type { UserRole } from "@/types/database"

if (typeof window !== "undefined") {
  throw new Error("lib/auth/require-user.ts must never be imported client-side")
}

export interface AuthedUser {
  userId: string
  email: string
  role: UserRole
  fullName: string
  supabase: SupabaseClient
}

export type RequireUserResult =
  | { ok: true; user: AuthedUser }
  | { ok: false; response: NextResponse<{ error: string }> }

/**
 * Resolves the caller from the cookie session and loads their role from
 * `profiles`. The role is never taken from the request body or JWT metadata.
 * Pass `roles` to restrict the route; admins always pass.
 */
export async function requireUser(roles?: readonly UserRole[]): Promise<RequireUserResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Please sign in to continue" }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle()

  const role = (profile?.role ?? null) as UserRole | null
  if (!role) {
    return { ok: false, response: NextResponse.json({ error: "Profile not found" }, { status: 403 }) }
  }

  if (roles && role !== "admin" && !roles.includes(role)) {
    return { ok: false, response: NextResponse.json({ error: "You do not have access to this action" }, { status: 403 }) }
  }

  return {
    ok: true,
    user: {
      userId: user.id,
      email: user.email ?? "",
      role,
      fullName: (profile?.full_name as string | null) ?? user.email ?? "User",
      supabase,
    },
  }
}
