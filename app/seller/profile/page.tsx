"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import type { DefaultValues } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, ShieldCheck, UserCog } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Reveal } from "@/components/motion/Reveal"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { ChipInput } from "@/components/seller/ChipInput"
import { ProfileCompletionCard } from "@/components/seller/ProfileCompletionCard"
import { useSupabase } from "@/hooks/useSupabase"
import {
  sellerProfileSchema,
  RESPONSE_TIME_OPTIONS_HRS,
  type SellerProfileValues,
} from "@/components/seller/seller-profile-schema"
import type { Seller } from "@/types/database"

const defaultValues: DefaultValues<SellerProfileValues> = {
  display_name: "",
  tagline: "",
  avatar_url: "",
  skills: [],
  languages: [],
  portfolio_urls: [],
  response_time_hrs: 24,
}

interface KycState {
  fullLegalName: string
  idNumber: string
  payoutMethod: string
  bankName: string
  accountNumber: string
}

const initialKyc: KycState = {
  fullLegalName: "",
  idNumber: "",
  payoutMethod: "",
  bankName: "",
  accountNumber: "",
}

type SellerProfileRow = Pick<
  Seller,
  "display_name" | "tagline" | "avatar_url" | "skills" | "languages" | "portfolio_urls" | "response_time_hrs"
>

export default function SellerProfilePage() {
  const { user } = useSupabase()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [kyc, setKyc] = useState<KycState>(initialKyc)

  const form = useForm<SellerProfileValues>({
    resolver: zodResolver(sellerProfileSchema),
    defaultValues,
    mode: "onBlur",
  })

  const {
    register,
    watch,
    setValue,
    reset,
    handleSubmit,
    formState: { errors },
  } = form

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setLoading(true)
      try {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        // `.maybeSingle()` (not `.single()`) because a signed-in seller who
        // hasn't saved a profile yet legitimately has zero rows here —
        // `.single()` makes PostgREST return a 406 for that case instead of
        // null data. The form below still works with all-default values, and
        // saving upserts the row for a first-timer.
        const { data } = await supabase
          .from("sellers")
          .select("display_name, tagline, avatar_url, skills, languages, portfolio_urls, response_time_hrs")
          .eq("user_id", user.id)
          .maybeSingle()

        const row = data as SellerProfileRow | null
        if (row) {
          reset({
            display_name: row.display_name || "",
            tagline: row.tagline || "",
            avatar_url: row.avatar_url || "",
            skills: row.skills || [],
            languages: row.languages || [],
            portfolio_urls: row.portfolio_urls || [],
            response_time_hrs: row.response_time_hrs || 24,
          })
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user, reset])

  const onSubmit = async (values: SellerProfileValues) => {
    if (!user) return
    setSaving(true)
    setError(null)

    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      // `.upsert()` (not `.update()`) so a seller with no `sellers` row yet
      // (e.g. profile lookup above found nothing) still gets one created on
      // first save — an `.update()` on a non-existent row is a silent no-op.
      // Column set matches migration 005's insert grant exactly: never
      // touch status/level/registration_fee/stats from the client.
      const { error: upsertError } = await supabase
        .from("sellers")
        .upsert(
          {
            user_id: user.id,
            display_name: values.display_name,
            tagline: values.tagline || null,
            avatar_url: values.avatar_url || null,
            skills: values.skills,
            languages: values.languages,
            portfolio_urls: values.portfolio_urls,
            response_time_hrs: values.response_time_hrs,
          },
          { onConflict: "user_id" }
        )

      if (upsertError) {
        setError(upsertError.message)
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError("Something went wrong saving your profile. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const values = watch()
  const kycStarted = Boolean(kyc.fullLegalName.trim() || kyc.idNumber.trim() || kyc.payoutMethod)

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Reveal>
        <div className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Seller / Profile</p>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text-primary">Seller Profile</h2>
        </div>
      </Reveal>

      <ProfileCompletionCard values={values} kycStarted={kycStarted} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <PanelGroup title="Public Profile" className="space-y-4">
          <div className="space-y-4 rounded-lg border border-border bg-surface p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <UserCog className="h-4 w-4 text-accent-primary" /> Display Name
                </Label>
                <Input {...register("display_name")} placeholder="Your public seller name" />
                {errors.display_name && <p className="text-xs text-accent-danger">{errors.display_name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Response Time</Label>
                <select
                  {...register("response_time_hrs", { valueAsNumber: true })}
                  className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                >
                  {RESPONSE_TIME_OPTIONS_HRS.map((hrs) => (
                    <option key={hrs} value={hrs}>
                      within {hrs}h
                    </option>
                  ))}
                </select>
                {errors.response_time_hrs && <p className="text-xs text-accent-danger">{errors.response_time_hrs.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Tagline</Label>
              <Input {...register("tagline")} placeholder="e.g. Full-stack developer | 6+ years shipping SaaS" />
              {errors.tagline && <p className="text-xs text-accent-danger">{errors.tagline.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Avatar URL</Label>
              <Input {...register("avatar_url")} placeholder="https://..." />
              {errors.avatar_url && <p className="text-xs text-accent-danger">{errors.avatar_url.message}</p>}
            </div>
          </div>
        </PanelGroup>

        <PanelGroup title="Skills & Languages" className="space-y-4">
          <div className="grid gap-4 rounded-lg border border-border bg-surface p-6 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Skills</Label>
              <ChipInput
                values={values.skills}
                onChange={(next) => setValue("skills", next, { shouldValidate: true })}
                placeholder="Add a skill"
                maxItems={20}
                error={errors.skills?.message}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Languages</Label>
              <ChipInput
                values={values.languages}
                onChange={(next) => setValue("languages", next, { shouldValidate: true })}
                placeholder="Add a language"
                maxItems={10}
                error={errors.languages?.message}
              />
            </div>
          </div>
        </PanelGroup>

        <PanelGroup title="Portfolio" className="space-y-4">
          <div className="space-y-1.5 rounded-lg border border-border bg-surface p-6">
            <Label>Portfolio Links</Label>
            <ChipInput
              values={values.portfolio_urls}
              onChange={(next) => setValue("portfolio_urls", next, { shouldValidate: true })}
              placeholder="https://..."
              maxItems={10}
              error={errors.portfolio_urls?.message}
            />
          </div>
        </PanelGroup>

        {error && <p className="text-sm text-accent-danger">{error}</p>}

        <Button type="submit" variant="aurora" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saved ? "Saved!" : "Save Changes"}
        </Button>
      </form>

      <PanelGroup title="Verification & Payouts">
        <div className="space-y-4 rounded-lg border border-border bg-surface p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent-warning" />
              <h3 className="font-display text-base font-semibold text-text-primary">KYC / Payout Details</h3>
            </div>
            <Badge variant="warning">Coming Soon</Badge>
          </div>

          <p className="text-sm text-text-muted">
            Verification and payout collection aren&apos;t live yet. Anything entered below is kept only in this
            browser session and is never saved to your account.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Full Legal Name</Label>
              <Input
                value={kyc.fullLegalName}
                onChange={(e) => setKyc((k) => ({ ...k, fullLegalName: e.target.value }))}
                placeholder="As on your ID"
              />
            </div>
            <div className="space-y-1.5">
              <Label>CNIC / ID Number</Label>
              <Input
                value={kyc.idNumber}
                onChange={(e) => setKyc((k) => ({ ...k, idNumber: e.target.value }))}
                placeholder="XXXXX-XXXXXXX-X"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payout Method</Label>
              <select
                value={kyc.payoutMethod}
                onChange={(e) => setKyc((k) => ({ ...k, payoutMethod: e.target.value }))}
                className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
              >
                <option value="">Select a method</option>
                <option value="ibft">IBFT (Bank Transfer)</option>
                <option value="jazzcash">JazzCash</option>
                <option value="easypaisa">Easypaisa</option>
                <option value="stripe">Stripe Connect (international)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Bank Name</Label>
              <Input
                value={kyc.bankName}
                onChange={(e) => setKyc((k) => ({ ...k, bankName: e.target.value }))}
                placeholder="e.g. HBL, Meezan Bank"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Account Number / IBAN</Label>
              <Input
                value={kyc.accountNumber}
                onChange={(e) => setKyc((k) => ({ ...k, accountNumber: e.target.value }))}
                placeholder="PKXX XXXX XXXX XXXX XXXX XXXX"
              />
            </div>
          </div>

          <Button type="button" variant="secondary" disabled className="cursor-not-allowed opacity-60">
            Submit for Verification (Coming Soon)
          </Button>
        </div>
      </PanelGroup>
    </div>
  )
}
