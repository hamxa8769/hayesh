"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import type { DefaultValues } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ArrowLeft, ArrowRight, Loader2, Rocket, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/motion/Reveal"
import { WizardSteps } from "@/components/seller/WizardSteps"
import { GigOverviewStep } from "@/components/seller/GigOverviewStep"
import { GigPricingStep } from "@/components/seller/GigPricingStep"
import { GigGalleryFaqStep } from "@/components/seller/GigGalleryFaqStep"
import { GigReviewStep } from "@/components/seller/GigReviewStep"
import { gigWizardSchema, STEP_FIELDS, STEP_LABELS } from "@/components/seller/gig-wizard-schema"
import type { GigWizardValues } from "@/components/seller/gig-wizard-schema"
import { useSupabase } from "@/hooks/useSupabase"

const TOTAL_STEPS = STEP_LABELS.length

const defaultValues: DefaultValues<GigWizardValues> = {
  title: "",
  category: "",
  subcategory: "",
  tags: [],
  description: "",
  basic: { title: "", description: "", delivery_days: 3, revisions: 1, features: [] },
  standard: { title: "", description: "", delivery_days: 5, revisions: 3, features: [] },
  premium: { title: "", description: "", delivery_days: 7, revisions: 5, features: [] },
  premiumUnlimitedRevisions: false,
  gallery_urls: [],
  faq: [],
}

export default function NewGigPage() {
  const router = useRouter()
  const { user } = useSupabase()
  const prefersReducedMotion = useReducedMotion()
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [checkingSeller, setCheckingSeller] = useState(true)
  const [hasSellerProfile, setHasSellerProfile] = useState(false)

  const form = useForm<GigWizardValues>({
    resolver: zodResolver(gigWizardSchema),
    defaultValues,
    mode: "onBlur",
  })

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const checkSeller = async () => {
      setCheckingSeller(true)
      try {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        // `.maybeSingle()` (not `.single()`) because a signed-in user who
        // hasn't saved a seller profile yet legitimately has zero rows here
        // — `.single()` makes PostgREST return a 406 for that case instead
        // of null data.
        const { data: seller } = await supabase.from("sellers").select("id").eq("user_id", user.id).maybeSingle()
        if (cancelled) return
        setHasSellerProfile(Boolean(seller))
      } catch {
        if (!cancelled) setHasSellerProfile(false)
      } finally {
        if (!cancelled) setCheckingSeller(false)
      }
    }

    checkSeller()
    return () => {
      cancelled = true
    }
  }, [user])

  const goNext = async () => {
    const fields = STEP_FIELDS[step]
    const valid = fields ? await form.trigger(fields) : true
    if (!valid) return
    setDirection(1)
    setStep((s) => Math.min(s + 1, TOTAL_STEPS))
  }

  const goBack = () => {
    setDirection(-1)
    setStep((s) => Math.max(s - 1, 1))
  }

  const onSubmit = async (values: GigWizardValues) => {
    if (!user) {
      setSubmitError("You must be signed in as a seller.")
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      // `.maybeSingle()` (not `.single()`) because a seller profile might
      // not exist — `.single()` makes PostgREST return a 406 for that case
      // instead of null data.
      const { data: seller, error: sellerError } = await supabase
        .from("sellers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (sellerError || !seller) {
        setSubmitError("We couldn't find your seller profile. Complete seller registration first.")
        setSubmitting(false)
        return
      }

      const premiumRevisions = values.premiumUnlimitedRevisions ? null : values.premium.revisions

      const { error: insertError } = await supabase.from("gigs").insert({
        seller_id: seller.id,
        status: "pending",
        title: values.title,
        category: values.category,
        subcategory: values.subcategory || null,
        description: values.description,
        tags: values.tags,
        gallery_urls: values.gallery_urls,
        faq: values.faq,

        basic_title: values.basic.title,
        basic_description: values.basic.description,
        basic_price_pkr: values.basic.price_pkr,
        basic_price_usd: values.basic.price_usd,
        basic_delivery_days: values.basic.delivery_days,
        basic_revisions: values.basic.revisions,
        basic_features: values.basic.features,

        standard_title: values.standard.title,
        standard_description: values.standard.description,
        standard_price_pkr: values.standard.price_pkr,
        standard_price_usd: values.standard.price_usd,
        standard_delivery_days: values.standard.delivery_days,
        standard_revisions: values.standard.revisions,
        standard_features: values.standard.features,

        premium_title: values.premium.title,
        premium_description: values.premium.description,
        premium_price_pkr: values.premium.price_pkr,
        premium_price_usd: values.premium.price_usd,
        premium_delivery_days: values.premium.delivery_days,
        premium_revisions: premiumRevisions,
        premium_features: values.premium.features,
      })

      if (insertError) {
        setSubmitError(insertError.message)
        setSubmitting(false)
        return
      }

      router.push("/seller/gigs")
    } catch {
      setSubmitError("Something went wrong publishing your gig. Please try again.")
      setSubmitting(false)
    }
  }

  const stepContent = useMemo(() => {
    switch (step) {
      case 1:
        return <GigOverviewStep form={form} />
      case 2:
        return <GigPricingStep form={form} />
      case 3:
        return <GigGalleryFaqStep form={form} />
      default:
        return <GigReviewStep form={form} />
    }
  }, [step, form])

  const slideOffset = prefersReducedMotion ? 0 : direction * 24

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Reveal>
        <div className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Seller / Gigs / New</p>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text-primary">Create a New Gig</h2>
        </div>
      </Reveal>

      {checkingSeller ? (
        <div className="flex min-h-[30vh] items-center justify-center rounded-lg border border-border bg-surface">
          <Loader2 className="h-6 w-6 animate-spin text-accent-primary" />
        </div>
      ) : !hasSellerProfile ? (
        <div className="relative overflow-hidden rounded-lg border border-border bg-surface p-8">
          <span aria-hidden="true" className="aurora-bg absolute inset-x-0 top-0 h-[2px]" />
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-surface-elevated">
                <Store className="h-6 w-6 text-accent-primary" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold tracking-[-0.02em] text-text-primary">
                  Set up your seller profile first
                </h3>
                <p className="mt-1 max-w-md text-sm text-text-muted">
                  You need a seller profile before you can publish a gig. Add your display name and skills to get
                  started.
                </p>
              </div>
            </div>
            <Link href="/seller/profile" className="shrink-0">
              <Button variant="aurora">
                Set Up Profile <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-surface-elevated/60 p-4">
            <WizardSteps steps={STEP_LABELS} currentStep={step} />
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 rounded-lg border border-border bg-surface p-5 sm:p-6">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={{ opacity: 0, x: slideOffset }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -slideOffset }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                {stepContent}
              </motion.div>
            </AnimatePresence>

            {submitError && <p className="text-sm text-accent-danger">{submitError}</p>}

            <div className="flex items-center justify-between border-t border-border pt-5">
              <Button type="button" variant="ghost" onClick={goBack} disabled={step === 1 || submitting}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>

              {step < TOTAL_STEPS ? (
                <Button type="button" variant="aurora" onClick={goNext}>
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" variant="aurora" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                  {submitting ? "Publishing..." : "Publish Gig"}
                </Button>
              )}
            </div>
          </form>
        </>
      )}
    </div>
  )
}
