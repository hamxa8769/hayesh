'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, CheckCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TeacherWizardSteps } from '@/components/teacher/TeacherWizardSteps'
import { ConstellationField } from '@/components/three/ConstellationField'
import { cn } from '@/lib/utils/cn'

export interface WizardStep {
  id: string
  label: string
}

export interface WizardShellProps {
  steps: WizardStep[]
  current: number
  onBack: () => void
  onNext: () => void
  canNext: boolean
  isSubmitting?: boolean
  error?: string | null
  submitLabel?: string
  onSubmit?: () => void
  children: ReactNode
}

// Motion tokens — no shared lib/motionTokens.ts exists yet in this repo, so
// the values are inlined here per the design-system motion spec.
const MOTION_DURATION_NORMAL = 0.35
const MOTION_EASING_SMOOTH = [0.22, 1, 0.36, 1] as const
const STEP_SLIDE_DISTANCE = 20

const stepVariants: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction * STEP_SLIDE_DISTANCE,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -STEP_SLIDE_DISTANCE,
  }),
}

const reducedStepVariants: Variants = {
  enter: { opacity: 0, x: 0 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 0 },
}

interface VerticalStepRailProps {
  steps: WizardStep[]
  current: number
}

/** Sticky vertical rail — mirrors the constellation nodes 1:1 (mono numerals + labels). */
function VerticalStepRail({ steps, current }: VerticalStepRailProps) {
  return (
    <ol className="flex flex-col gap-5">
      {steps.map((step, index) => {
        const isComplete = index < current
        const isActive = index === current

        return (
          <li key={step.id} className="flex items-center gap-3">
            <span
              aria-current={isActive ? 'step' : undefined}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold transition-colors duration-300',
                isComplete && 'aurora-bg text-[#08090C]',
                isActive && !isComplete && 'border border-accent-primary text-accent-primary shadow-[0_0_16px_rgba(39,196,160,0.25)]',
                !isActive && !isComplete && 'border border-border text-text-muted'
              )}
            >
              {isComplete ? <Check className="h-4 w-4" /> : String(index + 1).padStart(2, '0')}
            </span>
            <span
              className={cn(
                'font-mono text-[11px] uppercase tracking-[0.12em] transition-colors duration-300',
                isActive ? 'text-text-primary' : 'text-text-muted'
              )}
            >
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Asymmetric onboarding shell — deliberately NOT a centered card (the rest of
 * Hayesh already uses those). Form panel sits left in a `.glass` panel that
 * slightly overlaps the ConstellationField 3D scene bleeding off the right
 * edge, for depth. The sticky vertical step rail mirrors the constellation
 * nodes. Back/Next/Submit stay visible at all times — Back is the one
 * exception, hidden (not just disabled) on step 0 so it never eats a click
 * that would go nowhere.
 */
export function WizardShell({
  steps,
  current,
  onBack,
  onNext,
  canNext,
  isSubmitting = false,
  error = null,
  submitLabel = 'Submit',
  onSubmit,
  children,
}: WizardShellProps) {
  const prefersReducedMotion = useReducedMotion()

  // Starts false on the server AND on the first client render, then resolves in
  // an effect — matching the mount-gate pattern used elsewhere so the markup is
  // identical on both sides and cannot trigger a hydration mismatch (React #418).
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const sync = () => setIsDesktop(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  const isLastStep = current === steps.length - 1
  const isFirstStep = current === 0

  // Derive step-transition direction from the previous render's `current`,
  // using React's sanctioned "adjust state during render" pattern instead of
  // reading/writing a ref during render (see .claude/rules/ecc/react/hooks.md).
  const [previousStep, setPreviousStep] = useState(current)
  if (previousStep !== current) {
    setPreviousStep(current)
  }
  const direction = current >= previousStep ? 1 : -1

  const activeStep = steps[current]
  const stepKey = activeStep?.id ?? String(current)

  const handlePrimary = () => {
    if (isLastStep) {
      onSubmit?.()
    } else {
      onNext()
    }
  }

  return (
    <div className="relative w-full overflow-hidden bg-background">
      {/*
        Exactly ONE ConstellationField is mounted at a time. Rendering both and
        hiding one with `lg:hidden` still allocates a second WebGL context (a
        0x0 canvas holding GPU memory against the browser's ~8-16 context cap),
        so the choice is made in JS, not CSS.
      */}
      {isDesktop ? (
        /* Desktop pane — bleeds to the viewport edge behind the form panel */
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-[52%] xl:w-[48%]"
        >
          <ConstellationField stage={current} totalStages={steps.length} variant="wizard" className="h-full w-full" />
        </div>
      ) : (
        /* Mobile band — collapses above the form */
        <div className="relative h-28 w-full overflow-hidden border-b border-border sm:h-36">
          <ConstellationField stage={current} totalStages={steps.length} variant="wizard" className="h-full w-full" />
        </div>
      )}

      <div className="relative z-10 mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-start lg:gap-0 lg:px-8 lg:py-20">
        {/* Vertical rail — desktop only, sticky for tall forms */}
        <div className="hidden lg:sticky lg:top-24 lg:mr-10 lg:flex lg:w-40 lg:flex-none lg:self-start">
          <VerticalStepRail steps={steps} current={current} />
        </div>

        {/* Horizontal rail — mobile / tablet only */}
        <div className="lg:hidden">
          <TeacherWizardSteps steps={steps.map((step) => step.label)} currentStep={current + 1} />
        </div>

        {/* Form panel — overlaps the constellation bleed on desktop for depth */}
        <div className="glass relative z-10 w-full rounded-lg p-6 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_30px_rgba(0,0,0,0.5)] sm:p-8 lg:max-w-2xl lg:-mr-16 xl:-mr-24">
          <div className="overflow-hidden">
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={stepKey}
                custom={direction}
                variants={prefersReducedMotion ? reducedStepVariants : stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: prefersReducedMotion ? 0 : MOTION_DURATION_NORMAL, ease: MOTION_EASING_SMOOTH }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-8 flex flex-col gap-4">
            {error && (
              <div
                role="alert"
                className="rounded-[10px] border border-accent-danger/30 bg-accent-danger/10 px-4 py-3 text-sm text-accent-danger"
              >
                {error}
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              {isFirstStep ? (
                <span aria-hidden="true" />
              ) : (
                <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
                  <ArrowLeft />
                  Back
                </Button>
              )}

              <Button type="button" variant="aurora" onClick={handlePrimary} disabled={!canNext || isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" />
                    {isLastStep ? submitLabel : 'Next'}
                  </>
                ) : isLastStep ? (
                  <>
                    <CheckCircle />
                    {submitLabel}
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
