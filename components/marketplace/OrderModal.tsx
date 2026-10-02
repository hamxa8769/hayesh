"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Clock, Loader2, RotateCcw, ShoppingBag, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatPKR } from "@/lib/utils/format"

const MIN_LENGTH = 10
const MAX_LENGTH = 5000

export interface OrderModalTier {
  key: "basic" | "standard" | "premium"
  label: string
  title: string | null
  price: number | null
  deliveryDays: number | null
  revisions: number | null
}

export interface OrderModalProps {
  open: boolean
  onClose: () => void
  gigId: string
  tier: OrderModalTier
}

export function OrderModal({ open, onClose, gigId, tier }: OrderModalProps) {
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()
  const [requirements, setRequirements] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submittingRef = useRef(submitting)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    submittingRef.current = submitting
  }, [submitting])

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("#gig-order-requirements")?.focus()
    })
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submittingRef.current) {
        setError(null)
        onClose()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("keydown", onKeyDown)
      previouslyFocused?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const close = () => {
    if (submitting) return
    setError(null)
    onClose()
  }

  const trimmedLength = requirements.trim().length
  const tooShort = trimmedLength < MIN_LENGTH

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (tooShort) {
      setError(`Please describe what you need (at least ${MIN_LENGTH} characters).`)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "gig", gig_id: gigId, tier: tier.key, requirements: requirements.trim() }),
      })
      if (res.status === 401) {
        router.push(`/auth/login?redirect=/marketplace/${gigId}`)
        return
      }
      const json = (await res.json().catch(() => null)) as { transaction_id?: string; error?: string } | null
      if (!res.ok || !json?.transaction_id) {
        setError(json?.error || "We couldn't place your order. Please try again.")
        setSubmitting(false)
        return
      }
      router.push(`/checkout/${json.transaction_id}`)
    } catch {
      setError("Network error. Please try again.")
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
            aria-labelledby="gig-order-modal-title"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="glass relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-accent-primary" />
                <h2 id="gig-order-modal-title" className="font-display text-lg font-semibold text-text-primary">
                  Place Order
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

            <div className="mt-5 rounded-lg border border-accent-primary/30 bg-surface-elevated p-4">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">{tier.label} package</p>
              <p className="mt-1 font-display text-base font-semibold text-text-primary">{tier.title || `${tier.label} Package`}</p>
              <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-accent-primary">{formatPKR(tier.price || 0)}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs tabular-nums text-text-muted">
                {tier.deliveryDays != null && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {tier.deliveryDays}d delivery
                  </span>
                )}
                {tier.revisions != null && (
                  <span className="inline-flex items-center gap-1">
                    <RotateCcw className="h-3 w-3" /> {tier.revisions} revisions
                  </span>
                )}
              </div>
            </div>

            <form onSubmit={submit} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="gig-order-requirements" className="text-sm font-medium text-text-muted">
                  Describe what you need
                </label>
                <textarea
                  id="gig-order-requirements"
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value.slice(0, MAX_LENGTH))}
                  rows={6}
                  maxLength={MAX_LENGTH}
                  placeholder="Share the details, references and any deadlines the seller should know."
                  className="w-full resize-none rounded-lg border border-border bg-surface-elevated px-3 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                />
                <p className="text-right font-mono text-xs tabular-nums text-text-muted">
                  {requirements.length} / {MAX_LENGTH}
                </p>
              </div>

              {error && (
                <p role="alert" className="text-sm text-accent-danger">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={close} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="aurora" disabled={submitting || tooShort}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Continue to payment
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
