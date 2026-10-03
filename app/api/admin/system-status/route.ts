import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { getConfigChecks } from "@/lib/config/status"

/** GET /api/admin/system-status — which server settings are configured (admin only, no values). */
export async function GET() {
  const auth = await requireUser(["admin"])
  if (!auth.ok) return auth.response
  return NextResponse.json({ checks: getConfigChecks() })
}
