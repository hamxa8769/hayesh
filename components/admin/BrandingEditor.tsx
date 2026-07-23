"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Check, Info, Loader2, Palette } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { BrandingConfig } from "@/lib/branding"

/**
 * Client-side mirror of lib/branding.ts's enums. Duplicated on purpose:
 * lib/branding.ts imports "@/lib/supabase/server" (next/headers), which
 * must never end up in a client bundle, so this file only takes `import
 * type` from it (erased at compile time) and re-declares the small enum
 * literals + limits it needs at runtime. Keep these in sync with
 * lib/branding.ts if the enums ever change.
 */
const HEX_REGEX = /^#[0-9a-fA-F]{6}$/
const FONT_OPTIONS = [
  { value: "geist", label: "Geist (default)" },
  { value: "system", label: "System UI" },
  { value: "serif", label: "Editorial serif" },
  { value: "mono", label: "Monospace" },
] as const
const SCROLLBAR_OPTIONS = [
  { value: "default", label: "Default — thin accent thumb" },
  { value: "aurora", label: "Aurora — jade to gold gradient" },
  { value: "minimal", label: "Minimal — thin, low-contrast" },
] as const
const LIMITS = { disclaimer: 800, aiPackageNote: 400, aiServiceBrandName: 80 }

const brandingFormSchema = z.object({
  accentPrimary: z.string().regex(HEX_REGEX, "Use a 6-digit hex color, e.g. #27C4A0"),
  accentSecondary: z.string().regex(HEX_REGEX, "Use a 6-digit hex color, e.g. #F5B84E"),
  logoUrl: z
    .string()
    .trim()
    .refine((v) => v === "" || /^https?:\/\//i.test(v), "Must be a full http(s) URL, or left empty"),
  font: z.enum(["geist", "system", "serif", "mono"]),
  scrollbar: z.enum(["default", "aurora", "minimal"]),
  disclaimer: z.string().max(LIMITS.disclaimer, `Keep it under ${LIMITS.disclaimer} characters`),
  aiPackageNote: z.string().max(LIMITS.aiPackageNote, `Keep it under ${LIMITS.aiPackageNote} characters`),
  aiServiceBrandName: z
    .string()
    .trim()
    .min(1, "Cannot be empty")
    .max(LIMITS.aiServiceBrandName, `Keep it under ${LIMITS.aiServiceBrandName} characters`),
})

type BrandingFormValues = z.infer<typeof brandingFormSchema>

function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const result = {} as Pick<T, K>
  for (const key of keys) result[key] = obj[key]
  return result
}

function Section({
  title,
  description,
  children,
  status,
}: {
  title: string
  description: string
  children: ReactNode
  status: SectionStatus
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">{title}</h2>
      <p className="mt-1 max-w-prose text-sm text-text-muted">{description}</p>
      <div className="mt-5 space-y-4">{children}</div>
      {status.error && <p className="mt-3 text-xs text-accent-danger">{status.error}</p>}
      {status.saved && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-accent-success">
          <Check className="h-3.5 w-3.5" aria-hidden="true" /> Saved — live on the site now.
        </p>
      )}
    </section>
  )
}

interface SectionStatus {
  saving: boolean
  saved: boolean
  error: string | null
}

const IDLE_STATUS: SectionStatus = { saving: false, saved: false, error: null }

type SectionKey = "colors" | "logo" | "font" | "scrollbar" | "disclaimer" | "aiPackage"

const SECTION_FIELDS: Record<SectionKey, (keyof BrandingFormValues)[]> = {
  colors: ["accentPrimary", "accentSecondary"],
  logo: ["logoUrl"],
  font: ["font"],
  scrollbar: ["scrollbar"],
  disclaimer: ["disclaimer"],
  aiPackage: ["aiPackageNote", "aiServiceBrandName"],
}

export function BrandingEditor() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<Record<SectionKey, SectionStatus>>({
    colors: IDLE_STATUS,
    logo: IDLE_STATUS,
    font: IDLE_STATUS,
    scrollbar: IDLE_STATUS,
    disclaimer: IDLE_STATUS,
    aiPackage: IDLE_STATUS,
  })

  const {
    register,
    reset,
    trigger,
    getValues,
    watch,
    formState: { errors },
  } = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingFormSchema),
    defaultValues: {
      accentPrimary: "#27C4A0",
      accentSecondary: "#F5B84E",
      logoUrl: "",
      font: "geist",
      scrollbar: "default",
      disclaimer: "",
      aiPackageNote: "",
      aiServiceBrandName: "HayeshAI Studio",
    },
  })

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch("/api/admin/branding")
      const json = (await res.json()) as { branding?: BrandingConfig; error?: string }
      if (!res.ok || !json.branding) throw new Error(json.error ?? "Could not load branding")
      reset(json.branding)
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Could not load branding")
    } finally {
      setLoading(false)
    }
  }, [reset])

  useEffect(() => {
    load()
  }, [load])

  const saveSection = async (section: SectionKey) => {
    const fields = SECTION_FIELDS[section]
    const isValid = await trigger(fields)
    if (!isValid) return

    setStatuses((prev) => ({ ...prev, [section]: { saving: true, saved: false, error: null } }))
    try {
      const payload = pick(getValues(), fields)
      const res = await fetch("/api/admin/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branding: payload }),
      })
      const json = (await res.json()) as { branding?: BrandingConfig; error?: string }
      if (!res.ok || !json.branding) throw new Error(json.error ?? "Could not save")

      reset(json.branding)
      setStatuses((prev) => ({ ...prev, [section]: { saving: false, saved: true, error: null } }))
      router.refresh()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not save"
      setStatuses((prev) => ({ ...prev, [section]: { saving: false, saved: false, error: message } }))
    }
  }

  const accentPrimary = watch("accentPrimary")
  const accentSecondary = watch("accentSecondary")
  const logoUrl = watch("logoUrl")

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg border border-border bg-surface" />
        ))}
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-6 text-center">
        <Palette className="mx-auto h-8 w-8 text-accent-danger" aria-hidden="true" />
        <p className="mt-3 text-sm text-accent-danger">{loadError}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={load}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
      <p className="flex items-start gap-2 rounded-lg border border-accent-primary/30 bg-accent-primary/10 p-3 text-xs text-text-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-primary" aria-hidden="true" />
        <span>
          <strong className="text-text-primary">These apply site-wide, immediately after save.</strong> Each section
          below saves independently — no rebuild or redeploy needed. Colors and fonts restyle every page (including
          this one) the moment the request completes.
        </span>
      </p>

      <Section
        title="Accent colors"
        description="The signature jade-to-gold aurora accent used for CTAs, focus states, links, and highlights across the whole site."
        status={statuses.colors}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="accentPrimary">Primary (jade)</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Primary accent color picker"
                className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
                value={HEX_REGEX.test(accentPrimary ?? "") ? accentPrimary : "#27C4A0"}
                onChange={(e) => register("accentPrimary").onChange(e)}
              />
              <Input id="accentPrimary" {...register("accentPrimary")} placeholder="#27C4A0" className="font-mono" />
            </div>
            {errors.accentPrimary && <p className="text-xs text-accent-danger">{errors.accentPrimary.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="accentSecondary">Secondary (gold)</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Secondary accent color picker"
                className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
                value={HEX_REGEX.test(accentSecondary ?? "") ? accentSecondary : "#F5B84E"}
                onChange={(e) => register("accentSecondary").onChange(e)}
              />
              <Input
                id="accentSecondary"
                {...register("accentSecondary")}
                placeholder="#F5B84E"
                className="font-mono"
              />
            </div>
            {errors.accentSecondary && (
              <p className="text-xs text-accent-danger">{errors.accentSecondary.message}</p>
            )}
          </div>
        </div>
        <div
          className="h-10 w-full rounded-md border border-line-strong"
          style={{
            background: `linear-gradient(110deg, ${
              HEX_REGEX.test(accentPrimary ?? "") ? accentPrimary : "#27C4A0"
            } 0%, ${HEX_REGEX.test(accentSecondary ?? "") ? accentSecondary : "#F5B84E"} 100%)`,
          }}
          aria-hidden="true"
        />
        <Button type="button" variant="aurora" size="sm" disabled={statuses.colors.saving} onClick={() => saveSection("colors")}>
          {statuses.colors.saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Save accent colors
        </Button>
      </Section>

      <Section
        title="Logo"
        description="URL of the logo image shown in the site header. Direct upload can come later — for now, host it anywhere and paste the link."
        status={statuses.logo}
      >
        <div className="space-y-1.5">
          <Label htmlFor="logoUrl">Logo URL</Label>
          <Input id="logoUrl" {...register("logoUrl")} placeholder="https://…/logo.svg" />
          {errors.logoUrl && <p className="text-xs text-accent-danger">{errors.logoUrl.message}</p>}
        </div>
        {logoUrl && /^https?:\/\//i.test(logoUrl) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt="Logo preview"
            className="h-12 w-auto rounded-md border border-border bg-surface-elevated object-contain p-1.5"
          />
        )}
        <Button type="button" variant="aurora" size="sm" disabled={statuses.logo.saving} onClick={() => saveSection("logo")}>
          {statuses.logo.saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Save logo
        </Button>
      </Section>

      <Section
        title="Font"
        description="Base typeface for the whole site. Geist is the design-system default; the alternatives use fonts already available on every device, so there's no extra network load."
        status={statuses.font}
      >
        <div className="space-y-1.5">
          <Label htmlFor="font">Typeface</Label>
          <select
            id="font"
            {...register("font")}
            className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50 sm:max-w-md"
          >
            {FONT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" variant="aurora" size="sm" disabled={statuses.font.saving} onClick={() => saveSection("font")}>
          {statuses.font.saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Save font
        </Button>
      </Section>

      <Section
        title="Scrollbar"
        description="Style of the browser scrollbar thumb, applied globally."
        status={statuses.scrollbar}
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {SCROLLBAR_OPTIONS.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-elevated p-3 text-sm text-text-primary has-[:checked]:border-accent-primary has-[:checked]:shadow-[0_0_15px_rgba(39,196,160,0.2)]"
            >
              <input type="radio" value={o.value} {...register("scrollbar")} className="accent-[color:var(--color-accent-primary)]" />
              <span className="min-w-0">{o.label}</span>
            </label>
          ))}
        </div>
        <Button
          type="button"
          variant="aurora"
          size="sm"
          disabled={statuses.scrollbar.saving}
          onClick={() => saveSection("scrollbar")}
        >
          {statuses.scrollbar.saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Save scrollbar
        </Button>
      </Section>

      <Section
        title="Site disclaimer"
        description="Shown in the footer on every page. Leave empty to hide it."
        status={statuses.disclaimer}
      >
        <div className="space-y-1.5">
          <Label htmlFor="disclaimer">Disclaimer text</Label>
          <textarea
            id="disclaimer"
            {...register("disclaimer")}
            maxLength={LIMITS.disclaimer}
            rows={3}
            className="flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
            placeholder="e.g. Hayesh is an independent marketplace and is not affiliated with…"
          />
          {errors.disclaimer && <p className="text-xs text-accent-danger">{errors.disclaimer.message}</p>}
        </div>
        <Button
          type="button"
          variant="aurora"
          size="sm"
          disabled={statuses.disclaimer.saving}
          onClick={() => saveSection("disclaimer")}
        >
          {statuses.disclaimer.saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Save disclaimer
        </Button>
      </Section>

      <Section
        title="AI package note"
        description="Copy shown alongside AI-service package listings — the brand name is shared with the field of the same name on the Settings page."
        status={statuses.aiPackage}
      >
        <div className="space-y-1.5">
          <Label htmlFor="aiServiceBrandName">AI Studio brand name</Label>
          <Input id="aiServiceBrandName" {...register("aiServiceBrandName")} />
          {errors.aiServiceBrandName && (
            <p className="text-xs text-accent-danger">{errors.aiServiceBrandName.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="aiPackageNote">Package copy</Label>
          <textarea
            id="aiPackageNote"
            {...register("aiPackageNote")}
            maxLength={LIMITS.aiPackageNote}
            rows={3}
            className="flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
            placeholder="e.g. All AI packages include unlimited revisions within 24 hours."
          />
          {errors.aiPackageNote && <p className="text-xs text-accent-danger">{errors.aiPackageNote.message}</p>}
        </div>
        <Button
          type="button"
          variant="aurora"
          size="sm"
          disabled={statuses.aiPackage.saving}
          onClick={() => saveSection("aiPackage")}
        >
          {statuses.aiPackage.saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Save AI package note
        </Button>
      </Section>
    </form>
  )
}
