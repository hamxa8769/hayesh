"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { WizardShell } from "@/components/layout/WizardShell"
import type { WizardStep } from "@/components/layout/WizardShell"
import { TeacherProfileStep } from "@/components/teacher/TeacherProfileStep"
import { TeacherEducationStep } from "@/components/teacher/TeacherEducationStep"
import { TeacherExperienceStep } from "@/components/teacher/TeacherExperienceStep"
import { TeacherSubjectsStep } from "@/components/teacher/TeacherSubjectsStep"
import { TeacherDocumentsStep } from "@/components/teacher/TeacherDocumentsStep"
import { TeacherPricingStep } from "@/components/teacher/TeacherPricingStep"
import { TeacherAvailabilityStep } from "@/components/teacher/TeacherAvailabilityStep"
import { TeacherReviewStep } from "@/components/teacher/TeacherReviewStep"
import { onboardingSchema, STEP_FIELDS, STEP_LABELS } from "@/components/teacher/onboarding-schema"
import type { OnboardingValues } from "@/components/teacher/onboarding-schema"
import { createClient } from "@/lib/supabase/client"

const STEPS: WizardStep[] = STEP_LABELS.map((label) => ({
  id: label.toLowerCase().replace(/\s+/g, "-"),
  label,
}))

const DEFAULT_VALUES: OnboardingValues = {
  display_name: "",
  tagline: "",
  phone: "",
  profile_photo_url: "",
  languages: ["English"],
  education: [{ degree: "", institution: "", year: "", field: "" }],
  experience: [],
  subjects: [{ subject: "", level: "beginner" }],
  documents: [],
  group_price_pkr: "",
  standard_price_pkr: "",
  private_price_pkr: "",
  availability: {},
}

export default function TeacherOnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [initializing, setInitializing] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [canNext, setCanNext] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState("")

  const form = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onChange",
  })

  // Load the signed-in user + existing profile fields (full name, phone) to
  // pre-fill the form. `.maybeSingle()` (not `.single()`) — a missing
  // profiles row must never 406 and block onboarding.
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          router.push("/auth/login")
          return
        }
        if (!active) return
        setUserId(user.id)
        setEmail(user.email ?? "")

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", user.id)
          .maybeSingle()
        if (!active) return
        if (profile?.full_name) form.setValue("display_name", profile.full_name)
        if (profile?.phone) form.setValue("phone", profile.phone)
      } catch {
        // Non-fatal — the teacher can fill these fields in manually.
      } finally {
        if (active) setInitializing(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [router, form])

  // Reactive Next/Submit gating. The previous implementation read
  // `form.getValues()` inside a plain function called at render time, which
  // never triggers a re-render on keystrokes — the button looked stale or
  // vanished. `useWatch` subscribes to every field so this component
  // re-renders on each change; the effect then re-validates just the
  // current step's fields (or the whole schema on the Review step) via
  // RHF's own resolver, so validity is always in sync with the schema —
  // no duplicated validation rules. This has to be an effect (not derived
  // during render) because `trigger()` is async and writes into RHF's own
  // `formState.errors`.
  const watchedValues = useWatch({ control: form.control })
  useEffect(() => {
    let active = true
    const validateStep = async () => {
      const fields = STEP_FIELDS[step + 1]
      const valid = fields ? await form.trigger(fields, { shouldFocus: false }) : await form.trigger(undefined, { shouldFocus: false })
      if (active) setCanNext(valid)
    }
    validateStep()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `watchedValues` (not `form`) is the intentional re-validation trigger
  }, [step, watchedValues])

  const goBack = () => setStep((s) => Math.max(0, s - 1))
  const goNext = () => setStep((s) => Math.min(STEPS.length - 1, s + 1))

  const onSubmit = async (data: OnboardingValues) => {
    if (!userId) {
      setError("You must be signed in to finish setup.")
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: insertError } = await supabase.from("teachers").insert({
        user_id: userId,
        display_name: data.display_name,
        tagline: data.tagline || null,
        intro_video_url: null,
        profile_photo_url: data.profile_photo_url || null,
        education: data.education,
        experience: data.experience,
        subjects: data.subjects,
        availability: data.availability,
        group_price_pkr: data.group_price_pkr ? parseInt(data.group_price_pkr, 10) : null,
        group_price_usd: null,
        standard_price_pkr: data.standard_price_pkr ? parseInt(data.standard_price_pkr, 10) : null,
        standard_price_usd: null,
        private_price_pkr: data.private_price_pkr ? parseInt(data.private_price_pkr, 10) : null,
        private_price_usd: null,
        translation_languages: data.languages,
        documents: data.documents,
      })

      if (insertError) {
        setError(insertError.message)
        setSubmitting(false)
        return
      }

      // Saving the phone number is a courtesy update to `profiles`, entirely
      // separate from the teachers row that was just created. It must never
      // block finishing onboarding — swallow any failure here.
      try {
        await supabase.from("profiles").update({ phone: data.phone }).eq("id", userId)
      } catch {
        // Non-fatal.
      }

      router.push("/teacher/dashboard")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
      setSubmitting(false)
    }
  }

  const onInvalid = () => {
    setError("Please fix the highlighted fields before submitting.")
  }

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-accent-primary" />
      </div>
    )
  }

  return (
    <WizardShell
      steps={STEPS}
      current={step}
      onBack={goBack}
      onNext={goNext}
      canNext={canNext}
      isSubmitting={submitting}
      error={error}
      submitLabel="Finish Setup"
      onSubmit={form.handleSubmit(onSubmit, onInvalid)}
    >
      {step === 0 && <TeacherProfileStep form={form} email={email} userId={userId} />}
      {step === 1 && <TeacherEducationStep form={form} />}
      {step === 2 && <TeacherExperienceStep form={form} />}
      {step === 3 && <TeacherSubjectsStep form={form} />}
      {step === 4 && <TeacherDocumentsStep form={form} userId={userId} />}
      {step === 5 && <TeacherPricingStep form={form} />}
      {step === 6 && <TeacherAvailabilityStep form={form} />}
      {step === 7 && <TeacherReviewStep form={form} email={email} />}
    </WizardShell>
  )
}
