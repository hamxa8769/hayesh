"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Loader2, Wallet, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatPKR } from "@/lib/utils/format"
import {
  createWithdrawalSchema,
  PAYOUT_METHOD_OPTIONS,
  type WithdrawalValues,
} from "@/components/teacher/withdrawal-schema"

export interface WithdrawalRequestModalProps {
  open: boolean
  onClose: () => void
  availableBalance: number
  onSubmit: (values: WithdrawalValues) => Promise<{ error: string | null }>
}

const defaultValues: Partial<WithdrawalValues> = {
  currency: "PKR",
  payment_method: "ibft",
  bank_name: "",
  account_number: "",
  iban: "",
  notes: "",
}

export function WithdrawalRequestModal({ open, onClose, availableBalance, onSubmit }: WithdrawalRequestModalProps) {
  const prefersReducedMotion = useReducedMotion()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const submittingRef = useRef(submitting)
  const dialogRef = useRef<HTMLDivElement>(null)

  const schema = useMemo(() => createWithdrawalSchema(availableBalance), [availableBalance])

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<WithdrawalValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onBlur",
  })

  const paymentMethod = watch("payment_method")
  const needsBankName = paymentMethod === "ibft" || paymentMethod === "bank_transfer"

  useEffect(() => {
    submittingRef.current = submitting
  }, [submitting])

  // Matches the Escape-closes / focus-into-overlay / focus-restored-on-close
  // pattern established in components/jarvis/JarvisWidget.tsx + JarvisPanel.tsx.
  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("#wd-amount")?.focus()
    })
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submittingRef.current) {
        setSubmitError(null)
        reset(defaultValues)
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
    reset(defaultValues)
    onClose()
  }

  const submit = async (values: WithdrawalValues) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const { error } = await onSubmit(values)
      if (error) {
        setSubmitError(error)
        return
      }
      reset(defaultValues)
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
            aria-labelledby="withdrawal-modal-title"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="glass relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-accent-primary" />
                <h2 id="withdrawal-modal-title" className="font-display text-lg font-semibold text-text-primary">
                  Request Withdrawal
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

            <p className="mt-2 text-sm text-text-muted">
              Available to withdraw: <span className="font-mono tabular-nums text-accent-primary">{formatPKR(availableBalance)}</span>.
              An admin reviews every request before funds are released.
            </p>

            <form onSubmit={handleSubmit(submit)} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="wd-amount">Amount</Label>
                  <Input
                    id="wd-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    {...register("amount", { valueAsNumber: true })}
                    placeholder="0.00"
                  />
                  {errors.amount && <p className="text-xs text-accent-danger">{errors.amount.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wd-currency">Currency</Label>
                  <select
                    id="wd-currency"
                    {...register("currency")}
                    className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                  >
                    <option value="PKR">PKR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wd-method">Payout Method</Label>
                <select
                  id="wd-method"
                  {...register("payment_method")}
                  className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                >
                  {PAYOUT_METHOD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {errors.payment_method && <p className="text-xs text-accent-danger">{errors.payment_method.message}</p>}
              </div>

              {needsBankName && (
                <div className="space-y-1.5">
                  <Label htmlFor="wd-bank">Bank Name</Label>
                  <Input id="wd-bank" {...register("bank_name")} placeholder="e.g. HBL, Meezan Bank" />
                  {errors.bank_name && <p className="text-xs text-accent-danger">{errors.bank_name.message}</p>}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="wd-account">Account Number</Label>
                <Input id="wd-account" {...register("account_number")} placeholder="Account or mobile wallet number" />
                {errors.account_number && <p className="text-xs text-accent-danger">{errors.account_number.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wd-iban">IBAN (optional)</Label>
                <Input id="wd-iban" {...register("iban")} placeholder="PKXX XXXX XXXX XXXX XXXX XXXX" />
                {errors.iban && <p className="text-xs text-accent-danger">{errors.iban.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wd-notes">Notes (optional)</Label>
                <textarea
                  id="wd-notes"
                  {...register("notes")}
                  rows={3}
                  placeholder="Anything the admin should know about this request"
                  className="flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                />
                {errors.notes && <p className="text-xs text-accent-danger">{errors.notes.message}</p>}
              </div>

              {submitError && <p className="text-sm text-accent-danger">{submitError}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={close} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="aurora" disabled={submitting || availableBalance <= 0}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Submit Request
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
