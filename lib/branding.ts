import { createClient } from "@/lib/supabase/server"
import type { PlatformSetting, PlatformSettingValue } from "@/types/database"

/**
 * Site-wide branding, backed by public.platform_settings (key/value jsonb).
 *
 * This is the ONLY place that decides what is safe to inject into the
 * `<style id="hayesh-branding">` tag rendered by app/layout.tsx on every
 * request. Every field that ends up in that stylesheet (colors, font,
 * scrollbar) is constrained to a strict shape — a 6-digit hex regex or a
 * fixed enum — and looked up against a fixed table of literal CSS strings.
 * Free-text fields (disclaimer, AI package note, brand name, logo URL) are
 * NEVER passed to buildBrandingStyleCss(); they are only ever rendered as
 * React text/attribute values (auto-escaped) or read by client code that
 * needs the raw string, never concatenated into CSS or HTML.
 */

// ── Validation primitives ──────────────────────────────────────────────

export const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/

export const BRANDING_FONT_KEYS = ["geist", "system", "serif", "mono"] as const
export type BrandingFontKey = (typeof BRANDING_FONT_KEYS)[number]

export const BRANDING_SCROLLBAR_KEYS = ["default", "aurora", "minimal"] as const
export type BrandingScrollbar = (typeof BRANDING_SCROLLBAR_KEYS)[number]

export const BRANDING_TEXT_LIMITS = {
  disclaimer: 800,
  aiPackageNote: 400,
  aiServiceBrandName: 80,
} as const

/** Fixed CSS font-family stacks. Admin selects a KEY — never raw font text
 *  — so only these literal strings can ever reach the stylesheet. */
export const BRANDING_FONT_STACKS: Record<BrandingFontKey, { label: string; css: string }> = {
  geist: {
    label: "Geist (default)",
    css: "var(--font-geist), ui-sans-serif, system-ui, sans-serif",
  },
  system: {
    label: "System UI",
    css: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  serif: {
    label: "Editorial serif",
    css: 'Georgia, Cambria, "Times New Roman", Times, serif',
  },
  mono: {
    label: "Monospace",
    css: 'var(--font-geist-mono), ui-monospace, "SFMono-Regular", Menlo, monospace',
  },
}

export const BRANDING_SCROLLBAR_LABELS: Record<BrandingScrollbar, string> = {
  default: "Default — thin accent thumb",
  aurora: "Aurora — jade to gold gradient thumb",
  minimal: "Minimal — thin, low-contrast",
}

// ── Config shape ────────────────────────────────────────────────────────

export interface BrandingConfig {
  accentPrimary: string
  accentSecondary: string
  logoUrl: string
  font: BrandingFontKey
  scrollbar: BrandingScrollbar
  disclaimer: string
  aiPackageNote: string
  aiServiceBrandName: string
}

export const DEFAULT_BRANDING: BrandingConfig = {
  accentPrimary: "#27C4A0",
  accentSecondary: "#F5B84E",
  logoUrl: "",
  font: "geist",
  scrollbar: "default",
  disclaimer: "",
  aiPackageNote: "",
  aiServiceBrandName: "HayeshAI Studio",
}

/** platform_settings.key for each branding field. `aiServiceBrandName`
 *  intentionally reuses the pre-existing `ai_service_brand_name` row
 *  (also surfaced on /admin/settings) instead of a duplicate key. */
export const BRANDING_KEYS: Record<keyof BrandingConfig, string> = {
  accentPrimary: "branding_accent_primary",
  accentSecondary: "branding_accent_secondary",
  logoUrl: "branding_logo_url",
  font: "branding_font",
  scrollbar: "branding_scrollbar",
  disclaimer: "branding_disclaimer",
  aiPackageNote: "branding_ai_package_note",
  aiServiceBrandName: "ai_service_brand_name",
}

// ── Sanitizers (defense in depth: re-validated even though the write path
// already validates, in case rows are ever touched outside the API route) ──

function sanitizeHexOrDefault(value: PlatformSettingValue, fallback: string): string {
  return typeof value === "string" && HEX_COLOR_REGEX.test(value) ? value : fallback
}

function sanitizeFontOrDefault(value: PlatformSettingValue): BrandingFontKey {
  return typeof value === "string" && (BRANDING_FONT_KEYS as readonly string[]).includes(value)
    ? (value as BrandingFontKey)
    : DEFAULT_BRANDING.font
}

function sanitizeScrollbarOrDefault(value: PlatformSettingValue): BrandingScrollbar {
  return typeof value === "string" && (BRANDING_SCROLLBAR_KEYS as readonly string[]).includes(value)
    ? (value as BrandingScrollbar)
    : DEFAULT_BRANDING.scrollbar
}

function sanitizeUrlOrEmpty(value: PlatformSettingValue): string {
  if (typeof value !== "string" || value.trim() === "") return ""
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? value : ""
  } catch {
    return ""
  }
}

function sanitizeText(value: PlatformSettingValue, maxLen: number): string {
  return typeof value === "string" ? value.slice(0, maxLen) : ""
}

function sanitizeBrandName(value: PlatformSettingValue): string {
  return typeof value === "string" && value.trim() !== ""
    ? value.slice(0, BRANDING_TEXT_LIMITS.aiServiceBrandName)
    : DEFAULT_BRANDING.aiServiceBrandName
}

/** Pure mapper: platform_settings rows -> a fully-sanitized BrandingConfig.
 *  Missing or malformed rows fall back to DEFAULT_BRANDING per field. */
export function mapRowsToBranding(rows: readonly PlatformSetting[]): BrandingConfig {
  const byKey = new Map(rows.map((row) => [row.key, row.value]))
  const get = (field: keyof BrandingConfig): PlatformSettingValue => byKey.get(BRANDING_KEYS[field]) ?? null

  return {
    accentPrimary: sanitizeHexOrDefault(get("accentPrimary"), DEFAULT_BRANDING.accentPrimary),
    accentSecondary: sanitizeHexOrDefault(get("accentSecondary"), DEFAULT_BRANDING.accentSecondary),
    logoUrl: sanitizeUrlOrEmpty(get("logoUrl")),
    font: sanitizeFontOrDefault(get("font")),
    scrollbar: sanitizeScrollbarOrDefault(get("scrollbar")),
    disclaimer: sanitizeText(get("disclaimer"), BRANDING_TEXT_LIMITS.disclaimer),
    aiPackageNote: sanitizeText(get("aiPackageNote"), BRANDING_TEXT_LIMITS.aiPackageNote),
    aiServiceBrandName: sanitizeBrandName(get("aiServiceBrandName")),
  }
}

/**
 * Server-only convenience loader for app/layout.tsx. Reads through the
 * cookie-scoped client (RLS already lets anyone SELECT platform_settings),
 * and NEVER throws — a failed read must not take the whole site down, it
 * just falls back to the built-in Obsidian Aurora defaults.
 */
export async function getBranding(): Promise<BrandingConfig> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("platform_settings")
      .select("*")
      .in("key", Object.values(BRANDING_KEYS))

    if (error || !data) return DEFAULT_BRANDING
    return mapRowsToBranding(data as PlatformSetting[])
  } catch {
    return DEFAULT_BRANDING
  }
}

// ── Stylesheet generation ──────────────────────────────────────────────
// Every string below is either a fixed literal or a value that has just
// passed HEX_COLOR_REGEX / an enum membership check. No admin free-text
// (disclaimer, AI note, brand name, logo URL) ever reaches this function.

const SCROLLBAR_CSS: Record<BrandingScrollbar, string> = {
  default: "",
  aurora: `
::-webkit-scrollbar-thumb{background:linear-gradient(180deg,var(--color-jade),var(--color-gold)) !important;border-radius:3px !important;}
html{scrollbar-color:var(--color-jade) var(--color-surface);}
`,
  minimal: `
::-webkit-scrollbar{width:4px !important;}
::-webkit-scrollbar-thumb{background:var(--color-text-disabled) !important;border-radius:2px !important;}
html{scrollbar-width:thin;scrollbar-color:var(--color-text-disabled) transparent;}
`,
}

/** Builds the CSS text (no <style> wrapper) injected into <head> by
 *  app/layout.tsx. Colors win over both the dark default and the
 *  `:root[data-theme="light"]` override in globals.css via `!important`,
 *  since an admin-chosen accent should apply in both themes. */
export function buildBrandingStyleCss(branding: BrandingConfig): string {
  const accentPrimary = sanitizeHexOrDefault(branding.accentPrimary, DEFAULT_BRANDING.accentPrimary)
  const accentSecondary = sanitizeHexOrDefault(branding.accentSecondary, DEFAULT_BRANDING.accentSecondary)
  const fontKey = (BRANDING_FONT_KEYS as readonly string[]).includes(branding.font)
    ? branding.font
    : DEFAULT_BRANDING.font
  const scrollbarKey = (BRANDING_SCROLLBAR_KEYS as readonly string[]).includes(branding.scrollbar)
    ? branding.scrollbar
    : DEFAULT_BRANDING.scrollbar
  const fontCss = BRANDING_FONT_STACKS[fontKey].css

  const rootVarsCss = `:root{--color-accent-primary:${accentPrimary} !important;--color-accent-secondary:${accentSecondary} !important;--color-jade:${accentPrimary} !important;--color-gold:${accentSecondary} !important;--font-body:${fontCss} !important;--font-display:${fontCss} !important;}`

  return `${rootVarsCss}\n${SCROLLBAR_CSS[scrollbarKey]}`
}
