"use client"

import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Loader2, Pencil, Plus, Star, Trash2, Wallet, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  payoutAccountSchema,
  PAYOUT_METHOD_VALUES,
  PAYOUT_METHOD_LABELS,
  type PayoutAccountValues,
  type PayoutAccountListItem,
} from "@/components/shared/payout-account-schema"

const defaultValues: PayoutAccountValues = {
  payment_method: "ibft",
  bank_name: "",
  account_title: "",
  account_number: "",
  iban: "",
  is_default: false,
}

/**
 * Add / edit / delete a saved withdrawal account. Shared by the teacher and
 * seller profile editors. Talks only to /api/payout-accounts — never reads
 * or writes public.payment_methods directly, since the account number/IBAN
 * must be encrypted server-side and this component never sees (or asks for)
 * a decrypted value: editing an account means re-entering the account
 * number, not fetching the old one back.
 */
export function PayoutAccountEditor() {
  const prefersReducedMotion = useReducedMotion()
  const [accounts, setAccounts] = useState<PayoutAccountListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const submittingRef = useRef(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PayoutAccountValues>({
    resolver: zodResolver(payoutAccountSchema),
    defaultValues,
    mode: "onBlur",
  })
  const [submitError, setSubmitError] = useState<string | null>(null)

  const paymentMethod = watch("payment_method")
  const needsBankName = paymentMethod === "ibft" || paymentMethod === "bank_transfer"

  const loadAccounts = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch("/api/payout-accounts")
      const body = await res.json()
      if (!res.ok) {
        setLoadError(body.error || "Could not load your withdrawal accounts.")
        return
      }
      setAccounts(body.accounts ?? [])
    } catch {
      setLoadError("Could not load your withdrawal accounts. Check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  useEffect(() => {
    submittingRef.current = isSubmitting
  }, [isSubmitting])

  useEffect(() => {
    if (!formOpen) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("#payout-method")?.focus()
    })
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submittingRef.current) closeForm()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("keydown", onKeyDown)
      previouslyFocused?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- closeForm is stable enough for this modal lifecycle
  }, [formOpen])

  const openAddForm = () => {
    setEditingId(null)
    setSubmitError(null)
    reset(defaultValues)
    setFormOpen(true)
  }

  const openEditForm = (account: PayoutAccountListItem) => {
    setEditingId(account.id)
    setSubmitError(null)
    reset({
      ...defaultValues,
      payment_method: account.method,
      is_default: account.is_default ?? false,
    })
    setFormOpen(true)
  }

  const closeForm = () => {
    if (submittingRef.current) return
    setSubmitError(null)
    reset(defaultValues)
    setFormOpen(false)
  }

  const onSubmit = async (values: PayoutAccountValues) => {
    setSubmitError(null)
    try {
      const res = await fetch("/api/payout-accounts", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { ...values, id: editingId } : values),
      })
      const body = await res.json()
      if (!res.ok) {
        setSubmitError(body.error || "Something went wrong. Please try again.")
        return
      }
      reset(defaultValues)
      setFormOpen(false)
      await loadAccounts()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
    }
  }

  const deleteAccount = async (id: string) => {
    setDeletingId(id)
    setRowError(null)
    try {
      const res = await fetch(`/api/payout-accounts?id=${id}`, { method: "DELETE" })
      const body = await res.json()
      if (!res.ok) {
        setRowError(body.error || "Could not remove this account.")
        return
      }
      setAccounts((prev) => prev.filter((a) => a.id !== id))
    } catch {
      setRowError("Could not remove this account. Check your connection and try again.")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-accent-primary" />
          <h3 className="font-display text-base font-semibold text-text-primary">Withdrawal Accounts</h3>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={openAddForm}>
          <Plus className="h-3.5 w-3.5" /> Add Account
        </Button>
      </div>

      <p className="text-sm text-text-muted">
        Saved accounts are used when you request a withdrawal. Account numbers and IBANs are encrypted before
        storage — only the last 4 digits are ever shown here.
      </p>

      {loading ? (
        <div className="flex min-h-[8vh] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-accent-primary" />
        </div>
      ) : loadError ? (
        <p className="rounded-md border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-sm text-accent-danger">
          {loadError}
        </p>
      ) : accounts.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-text-muted">
          No withdrawal accounts saved yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-surface-elevated p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">
                    {PAYOUT_METHOD_LABELS[account.method]}
                  </span>
                  {account.is_default && (
                    <Badge variant="success" className="gap-1">
                      <Star className="h-3 w-3" /> Default
                    </Badge>
                  )}
                </div>
                <p className="truncate font-mono text-xs tabular-nums text-text-muted">
                  {account.label ? `${account.label} · ` : ""}•••• {account.account_last4 ?? "----"}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => openEditForm(account)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteAccount(account.id)}
                  disabled={deletingId === account.id}
                  className="text-accent-danger hover:text-accent-danger"
                >
                  {deletingId === account.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {rowError && <p className="text-xs text-accent-danger">{rowError}</p>}

      <AnimatePresence>
        {formOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.button
              aria-hidden="true"
              tabIndex={-1}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeForm}
            />

            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="payout-account-modal-title"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="glass relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 id="payout-account-modal-title" className="font-display text-lg font-semibold text-text-primary">
                  {editingId ? "Edit Withdrawal Account" : "Add Withdrawal Account"}
                </h2>
                <button
                  onClick={closeForm}
                  aria-label="Close"
                  className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {editingId && (
                <p className="mt-2 text-xs text-text-muted">
                  For security, account details are never shown again after saving. Re-enter them to update this
                  account.
                </p>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="payout-method">Payout Method</Label>
                  <select
                    id="payout-method"
                    {...register("payment_method")}
                    className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                  >
                    {PAYOUT_METHOD_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {PAYOUT_METHOD_LABELS[value]}
                      </option>
                    ))}
                  </select>
                  {errors.payment_method && <p className="text-xs text-accent-danger">{errors.payment_method.message}</p>}
                </div>

                {needsBankName && (
                  <div className="space-y-1.5">
                    <Label htmlFor="payout-bank-name">Bank Name</Label>
                    <Input id="payout-bank-name" {...register("bank_name")} placeholder="e.g. HBL, Meezan Bank" />
                    {errors.bank_name && <p className="text-xs text-accent-danger">{errors.bank_name.message}</p>}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="payout-account-title">Account Title (optional)</Label>
                  <Input id="payout-account-title" {...register("account_title")} placeholder="Name on the account" />
                  {errors.account_title && <p className="text-xs text-accent-danger">{errors.account_title.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="payout-account-number">Account Number</Label>
                  <Input
                    id="payout-account-number"
                    {...register("account_number")}
                    placeholder="Account or mobile wallet number"
                  />
                  {errors.account_number && <p className="text-xs text-accent-danger">{errors.account_number.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="payout-iban">IBAN (optional)</Label>
                  <Input id="payout-iban" {...register("iban")} placeholder="PKXX XXXX XXXX XXXX XXXX XXXX" />
                  {errors.iban && <p className="text-xs text-accent-danger">{errors.iban.message}</p>}
                </div>

                <label className="flex items-center gap-2 text-sm text-text-primary">
                  <input type="checkbox" {...register("is_default")} className="h-4 w-4 rounded border-border accent-accent-primary" />
                  Set as default withdrawal account
                </label>

                {submitError && (
                  <p className="rounded-md border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-sm text-accent-danger">
                    {submitError}
                  </p>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={closeForm} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="aurora" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {editingId ? "Save Changes" : "Add Account"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
