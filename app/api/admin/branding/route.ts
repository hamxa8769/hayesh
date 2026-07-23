import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  BRANDING_FONT_KEYS,
  BRANDING_KEYS,
  BRANDING_SCROLLBAR_KEYS,
  BRANDING_TEXT_LIMITS,
  HEX_COLOR_REGEX,
  mapRowsToBranding,
  type BrandingConfig,
} from "@/lib/branding"
import type { PlatformSetting } from "@/types/database"

/**
 * /api/admin/branding — GET/PATCH the site-wide branding config.
 *
 * Same shape as /api/admin/settings: cookie client authenticates + re-reads
 * profiles.role from the DB (never trusts the request body), then every
 * write goes through the service-role client so RLS + this route's own
 * per-key validation is the single source of truth.
 *
 * SECURITY — CSS/style injection: colors must match HEX_COLOR_REGEX
 * (^#[0-9a-fA-F]{6}$), font/scrollbar must be one of a fixed enum. Nothing
 * accepted here is ever concatenated into CSS directly — buildBrandingStyleCss
 * (lib/branding.ts) only accepts these same constrained shapes and looks
 * font/scrollbar up in a fixed table of literal CSS strings. Free-text
 * fields (disclaimer, AI note, brand name, logo URL) are capped in length
 * and never touch the stylesheet at all.
 */

const brandingPatchSchema = z.object({
  branding: z
    .object({
      accentPrimary: z.string().regex(HEX_COLOR_REGEX, "Must be a 6-digit hex color, e.g. #27C4A0"),
      accentSecondary: z.string().regex(HEX_COLOR_REGEX, "Must be a 6-digit hex color, e.g. #F5B84E"),
      logoUrl: z
        .string()
        .trim()
        .max(2048, "URL is too long")
        .refine(
          (value) => {
            if (value === "") return true
            try {
              const parsed = new URL(value)
              return parsed.protocol === "http:" || parsed.protocol === "https:"
            } catch {
              return false
            }
          },
          { message: "Must be a full http(s) URL, or left empty" }
        ),
      font: z.enum(BRANDING_FONT_KEYS),
      scrollbar: z.enum(BRANDING_SCROLLBAR_KEYS),
      disclaimer: z.string().max(BRANDING_TEXT_LIMITS.disclaimer, "Disclaimer is too long"),
      aiPackageNote: z.string().max(BRANDING_TEXT_LIMITS.aiPackageNote, "AI package note is too long"),
      aiServiceBrandName: z
        .string()
        .trim()
        .min(1, "Brand name cannot be empty")
        .max(BRANDING_TEXT_LIMITS.aiServiceBrandName, "Brand name is too long"),
    })
    .partial()
    .refine((obj) => Object.keys(obj).length > 0, { message: "No branding fields provided" }),
})

interface BrandingErrorResponse {
  error: string
}

async function requireAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse<BrandingErrorResponse> }
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

async function loadBranding(): Promise<BrandingConfig> {
  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from("platform_settings")
    .select("*")
    .in("key", Object.values(BRANDING_KEYS))

  return mapRowsToBranding((data ?? []) as PlatformSetting[])
}

export async function GET(): Promise<NextResponse<{ branding: BrandingConfig } | BrandingErrorResponse>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const branding = await loadBranding()
  return NextResponse.json({ branding })
}

export async function PATCH(
  request: Request
): Promise<NextResponse<{ branding: BrandingConfig } | BrandingErrorResponse>> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = brandingPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }

  const rows = Object.entries(parsed.data.branding).map(([field, value]) => ({
    key: BRANDING_KEYS[field as keyof BrandingConfig],
    value,
    updated_by: auth.userId,
    updated_at: new Date().toISOString(),
  }))

  const adminClient = createAdminClient()
  const { error } = await adminClient.from("platform_settings").upsert(rows, { onConflict: "key" })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const branding = await loadBranding()
  return NextResponse.json({ branding })
}
