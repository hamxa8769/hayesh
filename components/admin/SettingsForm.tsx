"use client"

import { useCallback, useEffect, useState } from "react"
import { useForm, type UseFormRegisterReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Check, Info, Loader2, Settings as SettingsIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PlatformSetting } from "@/types/database"

/**
 * Real control surface over public.platform_settings — the 11 seeded rows
 * that, before this screen existed, nothing in the app ever read or wrote.
 * Reads and writes both go through /api/admin/settings (admin-verified
 * server-side, service-role write) so validation lives in exactly one place.
 */

// Numbers are registered with `valueAsNumber`, so the schema's input and
// output types are both `number` — using z.coerce here would widen the input
// to `unknown` and break the resolver's type contract with useForm.
const numberField = z.number({ error: "Enter a number" })

const settingsFormSchema = z.object({
  teacher_commission_pct: numberField.min(0, "Must be 0 or more").max(100, "Cannot exceed 100%"),
  seller_commission_pct: numberField.min(0, "Must be 0 or more").max(100, "Cannot exceed 100%"),
  teacher_registration_fee_pkr: numberField.min(0, "Cannot be negative"),
  teacher_registration_fee_usd: numberField.min(0, "Cannot be negative"),
  seller_registration_fee_pkr: numberField.min(0, "Cannot be negative"),
  seller_registration_fee_usd: numberField.min(0, "Cannot be negative"),
  demo_lesson_duration_mins: numberField.int("Whole minutes only").min(1, "At least 1 minute").max(240, "Keep under 4 hours"),
  parent_premium_price_usd: numberField.min(0, "Cannot be negative"),
  ai_service_brand_name: z.string().trim().min(1, "Cannot be empty").max(80),
  translation_feature_enabled: z.boolean(),
  maintenance_mode: z.boolean(),
  ui_theme_accent: z.enum(["aurora-jade-gold", "ocean-cyan", "ember-rose", "violet-nova"]),
})

type SettingsFormValues = z.infer<typeof settingsFormSchema>

const DEFAULTS: SettingsFormValues = {
  teacher_commission_pct: 15,
  seller_commission_pct: 18,
  teacher_registration_fee_pkr: 2000,
  teacher_registration_fee_usd: 10,
  seller_registration_fee_pkr: 1000,
  seller_registration_fee_usd: 5,
  demo_lesson_duration_mins: 30,
  parent_premium_price_usd: 9.99,
  ai_service_brand_name: "HayeshAI Studio",
  translation_feature_enabled: true,
  maintenance_mode: false,
  ui_theme_accent: "aurora-jade-gold",
}

const THEME_OPTIONS: { value: SettingsFormValues["ui_theme_accent"]; label: string }[] = [
  { value: "aurora-jade-gold", label: "Aurora — jade to gold (current)" },
  { value: "ocean-cyan", label: "Ocean — cyan" },
  { value: "ember-rose", label: "Ember — rose" },
  { value: "violet-nova", label: "Violet nova" },
]

function toNumber(value: PlatformSetting["value"], fallback: number): number {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

function toBoolean(value: PlatformSetting["value"], fallback: boolean): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "string") return value === "true"
  return fallback
}

function toThemeAccent(value: PlatformSetting["value"]): SettingsFormValues["ui_theme_accent"] {
  const match = THEME_OPTIONS.find((o) => o.value === value)
  return match ? match.value : DEFAULTS.ui_theme_accent
}

function valuesFromRows(rows: PlatformSetting[]): SettingsFormValues {
  const byKey = new Map(rows.map((r) => [r.key, r.value]))
  const get = (key: string): PlatformSetting["value"] => byKey.get(key) ?? null
  return {
    teacher_commission_pct: toNumber(get("teacher_commission_pct"), DEFAULTS.teacher_commission_pct),
    seller_commission_pct: toNumber(get("seller_commission_pct"), DEFAULTS.seller_commission_pct),
    teacher_registration_fee_pkr: toNumber(get("teacher_registration_fee_pkr"), DEFAULTS.teacher_registration_fee_pkr),
    teacher_registration_fee_usd: toNumber(get("teacher_registration_fee_usd"), DEFAULTS.teacher_registration_fee_usd),
    seller_registration_fee_pkr: toNumber(get("seller_registration_fee_pkr"), DEFAULTS.seller_registration_fee_pkr),
    seller_registration_fee_usd: toNumber(get("seller_registration_fee_usd"), DEFAULTS.seller_registration_fee_usd),
    demo_lesson_duration_mins: toNumber(get("demo_lesson_duration_mins"), DEFAULTS.demo_lesson_duration_mins),
    parent_premium_price_usd: toNumber(get("parent_premium_price_usd"), DEFAULTS.parent_premium_price_usd),
    ai_service_brand_name:
      typeof get("ai_service_brand_name") === "string"
        ? String(get("ai_service_brand_name"))
        : DEFAULTS.ai_service_brand_name,
    translation_feature_enabled: toBoolean(get("translation_feature_enabled"), DEFAULTS.translation_feature_enabled),
    maintenance_mode: toBoolean(get("maintenance_mode"), DEFAULTS.maintenance_mode),
    ui_theme_accent: toThemeAccent(get("ui_theme_accent")),
  }
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">{title}</h2>
      <p className="mt-1 max-w-prose text-sm text-text-muted">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function NumberField({
  id,
  label,
  hint,
  error,
  registration,
  step,
}: {
  id: string
  label: string
  hint: string
  error?: string
  registration: UseFormRegisterReturn
  step?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" step={step ?? "1"} className="tabular-nums" {...registration} />
      <p className="text-xs text-text-muted">{hint}</p>
      {error && <p className="text-xs text-accent-danger">{error}</p>}
    </div>
  )
}

export function SettingsForm() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: DEFAULTS,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch("/api/admin/settings")
      const json = (await res.json()) as { settings?: PlatformSetting[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? "Could not load platform settings")
      reset(valuesFromRows(json.settings ?? []))
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Could not load platform settings")
    } finally {
      setLoading(false)
    }
  }, [reset])

  useEffect(() => {
    load()
  }, [load])

  const onSubmit = async (values: SettingsFormValues) => {
    setSaveError(null)
    setSaved(false)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: values }),
      })
      const json = (await res.json()) as { settings?: PlatformSetting[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? "Could not save settings")
      reset(valuesFromRows(json.settings ?? []))
      setSaved(true)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Could not save settings")
    }
  }

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-lg border border-border bg-surface" />
        ))}
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-6 text-center">
        <SettingsIcon className="mx-auto h-8 w-8 text-accent-danger" aria-hidden="true" />
        <p className="mt-3 text-sm text-accent-danger">{loadError}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={load}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Section
        title="Commission"
        description="The platform's cut, deducted from what a teacher or seller is paid out. Applied when a payout amount is calculated."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            id="teacher_commission_pct"
            label="Teacher commission (%)"
            hint="Taken from every monthly tuition before the teacher is paid."
            step="0.1"
            error={errors.teacher_commission_pct?.message}
            registration={register("teacher_commission_pct", { valueAsNumber: true })}
          />
          <NumberField
            id="seller_commission_pct"
            label="Seller commission (%)"
            hint="Taken from every completed gig order before the seller is paid."
            step="0.1"
            error={errors.seller_commission_pct?.message}
            registration={register("seller_commission_pct", { valueAsNumber: true })}
          />
        </div>
      </Section>

      <Section
        title="Registration fees"
        description="One-time fee a teacher or seller pays to join. Charged in PKR for Pakistani accounts and USD for everyone else."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField
            id="teacher_registration_fee_pkr"
            label="Teacher fee (PKR)"
            hint="Pakistani teachers."
            error={errors.teacher_registration_fee_pkr?.message}
            registration={register("teacher_registration_fee_pkr", { valueAsNumber: true })}
          />
          <NumberField
            id="teacher_registration_fee_usd"
            label="Teacher fee (USD)"
            hint="International teachers."
            step="0.01"
            error={errors.teacher_registration_fee_usd?.message}
            registration={register("teacher_registration_fee_usd", { valueAsNumber: true })}
          />
          <NumberField
            id="seller_registration_fee_pkr"
            label="Seller fee (PKR)"
            hint="Pakistani sellers."
            error={errors.seller_registration_fee_pkr?.message}
            registration={register("seller_registration_fee_pkr", { valueAsNumber: true })}
          />
          <NumberField
            id="seller_registration_fee_usd"
            label="Seller fee (USD)"
            hint="International sellers."
            step="0.01"
            error={errors.seller_registration_fee_usd?.message}
            registration={register("seller_registration_fee_usd", { valueAsNumber: true })}
          />
        </div>
      </Section>

      <Section
        title="Lessons & plans"
        description="Defaults applied when a demo lesson is booked and the price shown for the parent premium plan."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            id="demo_lesson_duration_mins"
            label="Demo lesson length (minutes)"
            hint="Pre-filled when a parent books a free demo."
            error={errors.demo_lesson_duration_mins?.message}
            registration={register("demo_lesson_duration_mins", { valueAsNumber: true })}
          />
          <NumberField
            id="parent_premium_price_usd"
            label="Parent premium (USD / month)"
            hint="Monthly price of the premium parent plan."
            step="0.01"
            error={errors.parent_premium_price_usd?.message}
            registration={register("parent_premium_price_usd", { valueAsNumber: true })}
          />
        </div>
      </Section>

      <Section
        title="Features & branding"
        description="Platform-wide switches. Maintenance mode and the translation toggle affect every user at once."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ai_service_brand_name">AI service brand name</Label>
            <Input id="ai_service_brand_name" {...register("ai_service_brand_name")} />
            <p className="text-xs text-text-muted">Shown as the brand on every AI service listing.</p>
            {errors.ai_service_brand_name && (
              <p className="text-xs text-accent-danger">{errors.ai_service_brand_name.message}</p>
            )}
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-surface-elevated p-3">
            <input
              type="checkbox"
              {...register("translation_feature_enabled")}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--color-accent-primary)]"
            />
            <span className="min-w-0">
              <span className="block text-sm text-text-primary">Live translation available</span>
              <span className="block text-xs text-text-muted">
                Global kill switch. Individual teachers still need translation enabled for them separately.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-accent-warning/40 bg-accent-warning/10 p-3">
            <input
              type="checkbox"
              {...register("maintenance_mode")}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--color-accent-warning)]"
            />
            <span className="min-w-0">
              <span className="block text-sm text-text-primary">Maintenance mode</span>
              <span className="block text-xs text-text-muted">
                High impact — intended to take the platform offline for everyone except admins.
              </span>
            </span>
          </label>
        </div>
      </Section>

      <Section
        title="Appearance"
        description="Accent preference for the platform's theme."
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ui_theme_accent">Accent palette</Label>
            <select
              id="ui_theme_accent"
              {...register("ui_theme_accent")}
              className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50 sm:max-w-md"
            >
              {THEME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <p className="flex items-start gap-2 rounded-lg border border-border bg-surface-elevated p-3 text-xs text-text-muted">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              <strong className="text-text-primary">Stored, not yet applied.</strong> This preference is saved to
              platform settings, but no part of the site reads it yet — the interface still renders with the built-in
              jade-to-gold aurora palette. Wiring it to the live theme is a separate change.
            </span>
          </p>
        </div>
      </Section>

      {saveError && (
        <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-4 py-3 text-sm text-accent-danger">
          {saveError}
        </div>
      )}
      {saved && !isDirty && (
        <p className="flex items-center gap-1.5 text-sm text-accent-success">
          <Check className="h-4 w-4" aria-hidden="true" /> Platform settings saved.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="aurora" disabled={isSubmitting || !isDirty}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Save settings
        </Button>
        {isDirty && (
          <Button type="button" variant="ghost" onClick={() => reset()}>
            Discard changes
          </Button>
        )}
      </div>
    </form>
  )
}
