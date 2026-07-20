import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { PlatformSetting } from "@/types/database"

/**
 * /api/admin/settings
 *
 * public.platform_settings is a key/value store (`key text primary key`,
 * `value jsonb`) seeded with 11 rows that, until this route existed, no app
 * code ever read. RLS already lets anyone SELECT these rows ("Anyone can
 * read platform settings") but only an admin may write ("Admin can manage
 * platform settings"). We still gate both verbs behind requireAdmin() here
 * — re-checked server-side from the database, never trusted from the
 * client — and write through the service-role client so a single route
 * owns validation for every key regardless of RLS.
 *
 * Each key has a known shape (percentage, currency, integer, string,
 * boolean) enforced by SETTINGS_SPEC below. Unknown keys and out-of-range
 * values are rejected rather than silently stored.
 */

const SETTINGS_SPEC = {
  teacher_commission_pct: z.number().min(0, "Must be at least 0%").max(100, "Cannot exceed 100%"),
  seller_commission_pct: z.number().min(0, "Must be at least 0%").max(100, "Cannot exceed 100%"),
  teacher_registration_fee_pkr: z.number().min(0, "Fee cannot be negative"),
  teacher_registration_fee_usd: z.number().min(0, "Fee cannot be negative"),
  seller_registration_fee_pkr: z.number().min(0, "Fee cannot be negative"),
  seller_registration_fee_usd: z.number().min(0, "Fee cannot be negative"),
  demo_lesson_duration_mins: z.number().int("Must be a whole number of minutes").min(1, "Must be at least 1 minute").max(240, "Keep it under 4 hours"),
  parent_premium_price_usd: z.number().min(0, "Price cannot be negative"),
  ai_service_brand_name: z.string().trim().min(1, "Brand name cannot be empty").max(80, "Keep it under 80 characters"),
  translation_feature_enabled: z.boolean(),
  maintenance_mode: z.boolean(),
  // Admin dashboard accent preference. Persisted here because
  // platform_settings is the only place to store admin-configurable UI
  // preferences with the current schema — but nothing in the app reads
  // this key yet. See SettingsForm.tsx for the "stored, not yet applied"
  // note shown to the admin.
  ui_theme_accent: z.enum(["aurora-jade-gold", "ocean-cyan", "ember-rose", "violet-nova"]),
} as const

type SettingKey = keyof typeof SETTINGS_SPEC

const patchSettingsSchema = z.object({
  settings: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .refine((obj) => Object.keys(obj).length > 0, { message: "No settings provided" }),
})

interface SettingsErrorResponse {
  error: string
}

async function requireAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse<SettingsErrorResponse> }
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

export async function GET(): Promise<NextResponse<{ settings: PlatformSetting[] } | SettingsErrorResponse>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const adminClient = createAdminClient()
  const { data, error } = await adminClient.from("platform_settings").select("*").order("key")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ settings: (data ?? []) as PlatformSetting[] })
}

export async function PATCH(
  request: Request
): Promise<NextResponse<{ settings: PlatformSetting[] } | SettingsErrorResponse>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = patchSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }

  const rows: { key: string; value: string | number | boolean; updated_by: string; updated_at: string }[] = []

  for (const [key, rawValue] of Object.entries(parsed.data.settings)) {
    const valueSchema = SETTINGS_SPEC[key as SettingKey] as z.ZodTypeAny | undefined
    if (!valueSchema) {
      return NextResponse.json({ error: `Unknown setting key: ${key}` }, { status: 400 })
    }

    const valueParsed = valueSchema.safeParse(rawValue)
    if (!valueParsed.success) {
      return NextResponse.json(
        { error: `${key}: ${valueParsed.error.issues[0]?.message ?? "invalid value"}` },
        { status: 400 }
      )
    }

    rows.push({
      key,
      value: valueParsed.data as string | number | boolean,
      updated_by: auth.userId,
      updated_at: new Date().toISOString(),
    })
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from("platform_settings")
    .upsert(rows, { onConflict: "key" })
    .select("*")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ settings: (data ?? []) as PlatformSetting[] })
}
