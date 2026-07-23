"use client"

import { useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Banknote, CreditCard, Landmark, Smartphone, Star, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { formatDate } from "@/lib/utils/format"
import { PAYMENT_METHOD_OPTION_LABELS, type PaymentMethodListItem, type PaymentMethodOption } from "@/components/parent/payment-schema"

export interface PaymentMethodCardProps {
  paymentMethod: PaymentMethodListItem
  index?: number
  onSetDefault: () => Promise<void>
  onDelete: () => Promise<void>
}

const METHOD_ICON: Record<string, typeof CreditCard> = {
  card_pk: CreditCard,
  jazzcash: Smartphone,
  easypaisa: Smartphone,
  ibft: Landmark,
  bank_transfer: Landmark,
  stripe: CreditCard,
}

function displayLabel(pm: PaymentMethodListItem): string {
  if (pm.label) return pm.label
  return PAYMENT_METHOD_OPTION_LABELS[pm.method as PaymentMethodOption] ?? pm.method
}

/** One saved payment method on /parent/payments — set-default + delete (with confirm). */
export function PaymentMethodCard({ paymentMethod, index = 0, onSetDefault, onDelete }: PaymentMethodCardProps) {
  const prefersReducedMotion = useReducedMotion()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [settingDefault, setSettingDefault] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const Icon = METHOD_ICON[paymentMethod.method] ?? Banknote
  const isDefault = paymentMethod.is_default ?? false

  const handleSetDefault = async () => {
    setSettingDefault(true)
    try {
      await onSetDefault()
    } finally {
      setSettingDefault(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await onDelete()
    } finally {
      setDeleting(false)
      setConfirmingDelete(false)
    }
  }

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: index * 0.05 }}
    >
      <JarvisCard glow="none" className={isDefault ? "border-accent-primary/40 p-5" : "p-5"}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-elevated text-accent-primary">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-bold text-text-primary">{displayLabel(paymentMethod)}</p>
              {paymentMethod.account_holder_name && (
                <p className="truncate text-xs text-text-muted">{paymentMethod.account_holder_name}</p>
              )}
              <p className="mt-0.5 truncate font-mono text-xs tabular-nums text-text-muted">
                •••• {paymentMethod.account_last4 ?? "----"}
              </p>
            </div>
          </div>
          {isDefault && (
            <span className="flex shrink-0 items-center gap-1 rounded-full border border-accent-primary/30 bg-accent-primary/10 px-2.5 py-0.5 font-mono text-xs uppercase tracking-wide text-accent-primary">
              <Star className="h-3 w-3 fill-current" />
              Default
            </span>
          )}
        </div>

        {paymentMethod.created_at && (
          <p className="mt-3 text-xs text-text-muted">Added {formatDate(paymentMethod.created_at)}</p>
        )}

        {confirmingDelete ? (
          <div className="mt-4 space-y-2 rounded-lg border border-accent-danger/30 bg-accent-danger/5 p-3">
            <p className="text-sm text-text-primary">Remove this payment method? This cannot be undone.</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Removing..." : "Yes, remove"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!isDefault && (
              <Button type="button" variant="secondary" size="sm" onClick={handleSetDefault} disabled={settingDefault}>
                <Star className="h-3.5 w-3.5" />
                {settingDefault ? "Saving..." : "Set as Default"}
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
          </div>
        )}
      </JarvisCard>
    </motion.div>
  )
}
