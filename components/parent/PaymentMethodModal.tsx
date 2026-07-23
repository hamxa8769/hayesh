"use client"

import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { CreditCard, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_METHOD_OPTION_LABELS,
  PAYMENT_METHOD_REFERENCE_HINT,
  PAYMENT_METHOD_HOLDER_LABEL,
  paymentMethodFormSchema,
  type PaymentMethodFormValues,
} from "@/components/parent/payment-schema"

export interface PaymentMethodModalProps {
  open: boolean
  onClose: () => void
  hasExistingDefault: boolean
  onSubmit: (values: PaymentMethodFormValues) => Promise<{ error: string | null }>
}

const emptyValues: PaymentMethodFormValues = {
  method: "card_pk",
  label: "",
  account_holder_name: "",
  account_reference: "",
  is_default: false,
}

/** Add-payment-method modal for /parent/payments. UI + persistence only — see the
 *  TODO below for where a real charge would eventually be authorized. */
export function PaymentMethodModal({ open, onClose, hasExistingDefault, onSubmit }: PaymentMethodModalProps) {
  const prefersReducedMotion = useReducedMotion()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const submittingRef = useRef(submitting)
  const dialogRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PaymentMethodFormValues>({
    resolver: zodResolver(paymentMethodFormSchema),
    defaultValues: { ...emptyValues, is_default: !hasExistingDefault },
    mode: "onBlur",
  })

  const selectedMethod = watch("method")

  useEffect(() => {
    submittingRef.current = submitting
  }, [submitting])

  useEffect(() => {
    if (open) {
      reset({ ...emptyValues, is_default: !hasExistingDefault })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasExistingDefault])

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("#payment-method-select")?.focus()
    })
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submittingRef.current) {
        setSubmitError(null)
        onClose()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("keydown", onKeyDown)
      previouslyFocused?.focus()
    }
  }, [open])

  const close = () => {
    if (submitting) return
    setSubmitError(null)
    onClose()
  }

  const submit = async (values: PaymentMethodFormValues) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const { error } = await onSubmit(values)
      if (error) {
        setSubmitError(error)
        return
      }
      onClose()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.button
            aria-hidden="true"
            tabIndex={-1}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-method-modal-title"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="glass relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-accent-primary" />
                <h2 id="payment-method-modal-title" className="font-display text-lg font-semibold text-text-primary">
                  Add Payment Method
                </h2>
              </div>
              <button
                onClick={close}
                aria-label="Close"
                className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(submit)} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="payment-method-select">Method</Label>
                <select
                  id="payment-method-select"
                  {...register("method")}
                  className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                >
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {PAYMENT_METHOD_OPTION_LABELS[option]}
                    </option>
                  ))}
                </select>
                {errors.method && <p className="text-xs text-accent-danger">{errors.method.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="payment-method-holder">{PAYMENT_METHOD_HOLDER_LABEL[selectedMethod]}</Label>
                <Input
                  id="payment-method-holder"
                  {...register("account_holder_name")}
                  placeholder="Full name as registered on the account"
                  autoComplete="off"
                />
                {errors.account_holder_name && (
                  <p className="text-xs text-accent-danger">{errors.account_holder_name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="payment-method-reference">{PAYMENT_METHOD_REFERENCE_HINT[selectedMethod]}</Label>
                <Input
                  id="payment-method-reference"
                  {...register("account_reference")}
                  placeholder={PAYMENT_METHOD_REFERENCE_HINT[selectedMethod]}
                  autoComplete="off"
                />
                {errors.account_reference && <p className="text-xs text-accent-danger">{errors.account_reference.message}</p>}
                <p className="text-xs text-text-muted">
                  Only the last 4 characters are ever displayed. The full value is encrypted before it is stored.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="payment-method-label">Nickname (optional)</Label>
                <Input id="payment-method-label" {...register("label")} placeholder="e.g. My main account" />
                {errors.label && <p className="text-xs text-accent-danger">{errors.label.message}</p>}
              </div>

              <label className="flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  {...register("is_default")}
                  className="h-4 w-4 rounded border-border bg-surface-elevated accent-accent-primary"
                />
                Set as default payment method
              </label>

              {/*
                TODO(payments): this only saves the method for reuse — no live
                payment keys exist yet (see CLAUDE.md: Simpaisa for PK users,
                Stripe Connect for international). Real charge authorization
                (Simpaisa checkout / Stripe PaymentIntent) hooks in here once
                keys are provisioned; this modal deliberately never talks to a
                payment SDK.
              */}
              {submitError && <p className="text-sm text-accent-danger">{submitError}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={close} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="aurora" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Method
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
