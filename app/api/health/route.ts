import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

/**
 * GET /api/health — uptime probe. 200 when the app can reach the database,
 * 503 otherwise. Exposes no data beyond up/down.
 */
export async function GET() {
  const started = Date.now()
  try {
    const { error } = await createAdminClient().from("platform_settings").select("key").limit(1)
    if (error) throw new Error(error.message)
    return NextResponse.json({ status: "ok", db: "ok", latency_ms: Date.now() - started })
  } catch {
    return NextResponse.json({ status: "degraded", db: "unreachable" }, { status: 503 })
  }
}
