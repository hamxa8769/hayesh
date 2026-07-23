"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { AlertTriangle, CreditCard, Plus, Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { StatusPill, type PillTone } from "@/components/teacher/StatusPill"
import { useSupabase } from "@/hooks/useSupabase"
import { PaymentMethodCard } from "@/components/parent/PaymentMethodCard"
import { PaymentMethodModal } from "@/components/parent/PaymentMethodModal"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import type { PaymentMethodFormValues, PaymentMethodListItem } from "@/components/parent/payment-schema"

/**
 * public.subscriptions row plus the joined teacher display name. Subscriptions
 * are the parent's monthly tuition billing — the "billing history" surface
 * this page shows alongside saved payment methods.
 */
interface SubscriptionWithTeacher {
  id: string
  child_name: string
  subject: string
  tier: string
  status: string | null
  amount_pkr: number | null
  amount_usd: number | null
  currency: string | null
  next_billing_date: string | null
  current_period_end: string | null
  created_at: string | null
  teachers: { display_name: string } | null
}

const SUBSCRIPTION_STATUS_TONE: Record<string, PillTone> = {
  active: "success",
  paused: "warning",
  past_due: "danger",
  cancelled: "neutral",
}

export default function ParentPaymentsPage() {
  const { user } = useSupabase()
  const [methods, setMethods] = useState<PaymentMethodListItem[]>([])
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithTeacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      const [methodsRes, subscriptionsRes] = await Promise.all([
        // account_reference is NEVER selected here — only the columns needed
        // to render a masked card. The ciphertext never reaches the browser.
        supabase
          .from("payment_methods")
          .select("id, method, label, account_holder_name, account_last4, is_default, created_at")
          .eq("user_id", user.id)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("subscriptions")
          .select(
            "id, child_name, subject, tier, status, amount_pkr, amount_usd, currency, next_billing_date, current_period_end, created_at, teachers(display_name)"
          )
          .eq("parent_id", user.id)
          .order("created_at", { ascending: false }),
      ])

      if (methodsRes.error) {
        setError(methodsRes.error.message)
        return
      }
      if (subscriptionsRes.error) {
        setError(subscriptionsRes.error.message)
        return
      }

      setMethods((methodsRes.data || []) as PaymentMethodListItem[])
      setSubscriptions((subscriptionsRes.data || []) as unknown as SubscriptionWithTeacher[])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load your payment info. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData])

  const hasExistingDefault = useMemo(() => methods.some((m) => m.is_default), [methods])

  const handleAddMethod = async (values: PaymentMethodFormValues): Promise<{ error: string | null }> => {
    try {
      const res = await fetch("/api/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: values.method,
          label: values.label || undefined,
          account_holder_name: values.account_holder_name,
          account_reference: values.account_reference,
          is_default: values.is_default,
        }),
      })

      if (!res.ok) {
        const payload: unknown = await res.json().catch(() => null)
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "Could not save this payment method."
        return { error: message }
      }
    } catch {
      return { error: "Could not reach the server. Check your connection and try again." }
    }

    await loadData()
    return { error: null }
  }

  const handleSetDefault = async (target: PaymentMethodListItem) => {
    if (!user) return
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()

    // Clear any other default first so exactly one row stays default — same
    // invariant the API route enforces on create. Plain owner-scoped updates
    // are safe to run directly from the client here: no encryption is
    // involved (account_reference is untouched) and RLS's "Owner manages own
    // payment methods" policy is the real enforcement boundary either way.
    const { error: clearError } = await supabase
      .from("payment_methods")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .eq("is_default", true)
    if (clearError) {
      setError(clearError.message)
      return
    }

    const { error: setError_ } = await supabase
      .from("payment_methods")
      .update({ is_default: true })
      .eq("id", target.id)
      .eq("user_id", user.id)
    if (setError_) {
      setError(setError_.message)
      return
    }

    await loadData()
  }

  const handleDelete = async (target: PaymentMethodListItem) => {
    try {
      const res = await fetch(`/api/payment-methods?id=${encodeURIComponent(target.id)}`, { method: "DELETE" })
      if (!res.ok) {
        const payload: unknown = await res.json().catch(() => null)
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "Could not remove this payment method."
        setError(message)
        return
      }
    } catch {
      setError("Could not reach the server. Check your connection and try again.")
      return
    }

    await loadData()
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div>
          <h2 className="font-display text-2xl font-bold text-text-primary">Payments</h2>
          <p className="mt-1 text-sm text-text-muted">Saved payment methods and your billing history.</p>
        </div>
        <Button type="button" variant="aurora" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Payment Method
        </Button>
      </motion.div>

      {/* ── Saved payment methods ────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Saved Methods</h3>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-lg border border-border bg-surface-elevated/60" />
            ))}
          </div>
        ) : error ? (
          <JarvisCard glow="none" className="p-8 text-center">
            <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-accent-danger" />
            <p className="text-text-primary">Couldn&apos;t load your payment info</p>
            <p className="mt-1 text-sm text-text-muted">{error}</p>
            <Button type="button" variant="secondary" className="mt-4" onClick={loadData}>
              Try Again
            </Button>
          </JarvisCard>
        ) : methods.length === 0 ? (
          <JarvisCard glow="none" className="p-8 text-center">
            <CreditCard className="mx-auto mb-3 h-12 w-12 text-text-disabled" />
            <p className="text-text-primary">No payment methods saved yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-text-muted">
              Save a card, JazzCash, Easypaisa, NayaPay, or bank transfer detail so you don&apos;t have to re-enter it
              every time.
            </p>
            <Button type="button" variant="aurora" className="mt-4" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Your First Method
            </Button>
          </JarvisCard>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {methods.map((method, i) => (
              <PaymentMethodCard
                key={method.id}
                paymentMethod={method}
                index={i}
                onSetDefault={() => handleSetDefault(method)}
                onDelete={() => handleDelete(method)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Billing history ──────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Billing History</h3>

        {loading ? (
          <div className="h-40 animate-pulse rounded-lg border border-border bg-surface-elevated/60" />
        ) : error ? null : subscriptions.length === 0 ? (
          <JarvisCard glow="none" className="p-8 text-center">
            <Receipt className="mx-auto mb-3 h-12 w-12 text-text-disabled" />
            <p className="text-text-primary">No billing history yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-text-muted">
              Once you subscribe to a teacher&apos;s monthly tuition, invoices and billing dates will show up here.
            </p>
          </JarvisCard>
        ) : (
          <JarvisCard glow="none" className="overflow-x-auto p-0">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-3 font-mono font-normal">Teacher / Subject</th>
                  <th className="px-4 py-3 font-mono font-normal">Tier</th>
                  <th className="px-4 py-3 font-mono font-normal">Amount</th>
                  <th className="px-4 py-3 font-mono font-normal">Status</th>
                  <th className="px-4 py-3 font-mono font-normal">Next Billing</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => {
                  const tone = SUBSCRIPTION_STATUS_TONE[sub.status ?? ""] ?? "neutral"
                  const amount =
                    sub.currency === "USD" && sub.amount_usd != null
                      ? formatCurrency(sub.amount_usd, "USD")
                      : sub.amount_pkr != null
                        ? formatCurrency(sub.amount_pkr, "PKR")
                        : "—"
                  return (
                    <tr key={sub.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium text-text-primary">{sub.teachers?.display_name ?? "Teacher"}</p>
                        <p className="text-xs text-text-muted">
                          {sub.subject} · {sub.child_name}
                        </p>
                      </td>
                      <td className="px-4 py-3 capitalize text-text-muted">{sub.tier}</td>
                      <td className="px-4 py-3 font-mono tabular-nums text-text-primary">{amount}</td>
                      <td className="px-4 py-3">
                        <StatusPill label={sub.status ?? "unknown"} tone={tone} />
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-text-muted">
                        {sub.next_billing_date ? formatDate(sub.next_billing_date) : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </JarvisCard>
        )}
      </section>

      <PaymentMethodModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        hasExistingDefault={hasExistingDefault}
        onSubmit={handleAddMethod}
      />
    </div>
  )
}
