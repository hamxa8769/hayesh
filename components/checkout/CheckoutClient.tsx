"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Landmark,
  Loader2,
  ShieldCheck,
  Smartphone,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils/cn"
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format"
import { CopyButton, PaymentAccountCard, hasPaymentAccounts } from "@/components/checkout/PaymentAccountCard"
import { ProofUploadForm } from "@/components/checkout/ProofUploadForm"
import type { PaymentAccounts } from "@/lib/payments/settings"
import type { Transaction } from "@/types/database"

interface CheckoutClientProps {
  transaction: Transaction
  accounts: PaymentAccounts
  stripeEnabled: boolean
  userId: string
}

const TYPE_LABELS: Record<string, string> = {
  tuition: "Tuition",
  gig: "Service order",
  ai_service: "HayeshAI Studio",
  registration: "Registration fee",
  featured: "Featured listing",
}

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer",
  ibft: "IBFT / Raast",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
  card: "Card",
}

const POLL_INTERVAL_MS = 4000
const POLL_MAX_MS = 60000

function nextDestination(type: string): { href: string; label: string } {
  if (type === "gig" || type === "ai_service") return { href: "/orders", label: "View my orders" }
  if (type === "tuition") return { href: "/parent/payments", label: "Go to payments" }
  return { href: "/teacher/dashboard", label: "Go to dashboard" }
}

function Banner({
  tone,
  icon,
  title,
  children,
}: {
  tone: "info" | "success" | "danger" | "neutral" | "warning"
  icon: React.ReactNode
  title: string
  children?: React.ReactNode
}) {
  const toneClass = {
    info: "border-accent-secondary/30 bg-accent-secondary/10 text-accent-secondary",
    success: "border-accent-success/30 bg-accent-success/10 text-accent-success",
    danger: "border-accent-danger/30 bg-accent-danger/10 text-accent-danger",
    warning: "border-accent-warning/30 bg-accent-warning/10 text-accent-warning",
    neutral: "border-border bg-surface text-text-muted",
  }[tone]
  return (
    <div role="status" className={cn("flex items-start gap-3 rounded-lg border p-4", toneClass)}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        {children && <div className="mt-1 text-sm text-text-muted">{children}</div>}
      </div>
    </div>
  )
}

export function CheckoutClient({ transaction: tx, accounts, stripeEnabled, userId }: CheckoutClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const stripeReturn = searchParams.get("stripe") === "success"
  const status = tx.status ?? "pending"
  const hasProof = Boolean(tx.bank_transfer_proof)
  const awaitingPayment = status === "pending" && !hasProof
  const [tab, setTab] = useState<"card" | "manual">(stripeEnabled ? "card" : "manual")
  const [cardLoading, setCardLoading] = useState(false)
  const [cardError, setCardError] = useState<string | null>(null)
  const [pollTimedOut, setPollTimedOut] = useState(false)

  const confirmingCard = stripeReturn && status === "pending" && !pollTimedOut

  useEffect(() => {
    if (!stripeReturn || status !== "pending") return
    const started = Date.now()
    const id = setInterval(() => {
      if (Date.now() - started >= POLL_MAX_MS) {
        clearInterval(id)
        setPollTimedOut(true)
        return
      }
      router.refresh()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [stripeReturn, status, router])

  async function payWithCard() {
    setCardError(null)
    setCardLoading(true)
    try {
      const res = await fetch(`/api/checkout/${tx.id}/stripe`, { method: "POST" })
      const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!res.ok || !body?.url) {
        throw new Error(body?.error ?? "Card payments are not available right now.")
      }
      window.location.href = body.url
    } catch (err) {
      setCardError(err instanceof Error ? err.message : "Could not start card payment.")
      setCardLoading(false)
    }
  }

  const currency = tx.currency === "USD" ? "USD" : "PKR"
  const dest = nextDestination(tx.type)
  const manualConfigured = hasPaymentAccounts(accounts)

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-border bg-surface p-5 sm:p-6">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
          {TYPE_LABELS[tx.type] ?? "Order"}
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
          {tx.description ?? "Hayesh order"}
        </h1>

        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Amount due</dt>
            <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums text-text-primary">
              {formatCurrency(tx.gross_amount, currency)}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Reference code</dt>
            <dd className="mt-1 flex items-center gap-2">
              <span className="break-all font-mono text-2xl font-semibold tracking-wider text-text-primary">
                {tx.reference_code ?? "—"}
              </span>
              {tx.reference_code && <CopyButton value={tx.reference_code} label="reference code" />}
            </dd>
          </div>
        </dl>
        {tx.created_at && (
          <p className="mt-4 text-xs text-text-muted">Created {formatDate(tx.created_at)}</p>
        )}
      </section>

      {confirmingCard && (
        <Banner tone="info" icon={<Loader2 className="size-5 animate-spin" />} title="Confirming your card payment…">
          This usually takes a few seconds. This page will update automatically.
        </Banner>
      )}
      {stripeReturn && status === "pending" && pollTimedOut && (
        <Banner tone="warning" icon={<AlertTriangle className="size-5" />} title="Still waiting for confirmation">
          Your card payment is taking longer than expected. Refresh this page in a minute, or contact support if
          you were charged.
        </Banner>
      )}

      {status === "pending" && hasProof && (
        <Banner tone="info" icon={<ShieldCheck className="size-5" />} title="Payment submitted — our team is verifying it (usually within a few hours)">
          <p>
            Method: <span className="text-text-primary">{METHOD_LABELS[tx.payment_method ?? ""] ?? tx.payment_method ?? "—"}</span>
            {tx.payer_reference && (
              <>
                {" · "}Transaction ID:{" "}
                <span className="font-mono text-text-primary">{tx.payer_reference}</span>
              </>
            )}
          </p>
          {tx.proof_submitted_at && <p className="mt-0.5">Submitted {formatDateTime(tx.proof_submitted_at)}</p>}
        </Banner>
      )}

      {(status === "processing" || status === "completed") && (
        <div className="flex flex-col gap-4">
          <Banner tone="success" icon={<CheckCircle2 className="size-5" />} title="Payment confirmed">
            {tx.paid_at ? <>Paid on {formatDateTime(tx.paid_at)}.</> : <>Thank you — your payment has been received.</>}
          </Banner>
          <Button asChild variant="aurora" size="lg">
            <Link href={dest.href}>{dest.label}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/receipts/${tx.id}`}>Download receipt</Link>
          </Button>
        </div>
      )}

      {status === "failed" && (
        <Banner tone="danger" icon={<AlertTriangle className="size-5" />} title="Payment failed">
          {tx.rejection_reason && <p className="text-text-primary">{tx.rejection_reason}</p>}
          <p>Start a new order or contact support.</p>
        </Banner>
      )}

      {status === "refunded" && (
        <Banner tone="neutral" icon={<ShieldCheck className="size-5" />} title="This payment was refunded">
          {tx.rejection_reason && <p>{tx.rejection_reason}</p>}
        </Banner>
      )}

      {awaitingPayment && !confirmingCard && (
        <section className="rounded-lg border border-border bg-surface p-5 sm:p-6">
          <Banner tone="warning" icon={<AlertTriangle className="size-5" />} title="Awaiting payment" />

          {stripeEnabled && (
            <div role="tablist" className="mt-5 flex gap-1 rounded-lg border border-border bg-background/40 p-1">
              {([
                { id: "card", label: "Card", icon: <CreditCard className="size-4" /> },
                { id: "manual", label: "Bank / JazzCash / Easypaisa", icon: <Landmark className="size-4" /> },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    tab === t.id
                      ? "bg-surface-elevated text-text-primary"
                      : "text-text-muted hover:text-text-primary"
                  )}
                >
                  {t.icon}
                  <span className="truncate">{t.label}</span>
                </button>
              ))}
            </div>
          )}

          {stripeEnabled && tab === "card" ? (
            <div className="mt-5 flex flex-col gap-4">
              <p className="text-sm text-text-muted">
                Pay securely by card. You will be redirected to our payment partner to complete the payment.
              </p>
              {cardError && (
                <p role="alert" className="flex items-start gap-2 text-sm text-accent-danger">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  {cardError}
                </p>
              )}
              <Button variant="aurora" size="lg" onClick={payWithCard} disabled={cardLoading}>
                {cardLoading ? <Loader2 className="animate-spin" /> : <CreditCard />}
                {cardLoading ? "Redirecting…" : `Pay ${formatCurrency(tx.gross_amount, currency)} by card`}
              </Button>
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-5">
              {manualConfigured ? (
                <>
                  <div className="flex flex-col gap-3">
                    <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
                      <Smartphone className="size-4" />
                      Step 1 · Send the payment
                    </p>
                    <PaymentAccountCard accounts={accounts} />
                    <p className="text-sm text-text-muted">
                      Write your reference code{" "}
                      <span className="font-mono text-text-primary">{tx.reference_code}</span> in the transfer note so
                      we can match your payment.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 border-t border-border pt-5">
                    <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
                      Step 2 · Submit your proof
                    </p>
                    <ProofUploadForm transactionId={tx.id} userId={userId} />
                  </div>
                </>
              ) : (
                <p className="rounded-lg border border-border bg-background/40 p-4 text-sm text-text-muted">
                  Online payment details are being set up — please contact support.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      <p className="text-xs text-text-muted">
        By paying you agree to our{" "}
        <Link href="/terms" className="underline hover:text-text-primary">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/refund-policy" className="underline hover:text-text-primary">
          Refund Policy
        </Link>
        .
      </p>

      <p className="flex items-start gap-2 text-xs text-text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        Payments are held securely by Hayesh. Teachers and sellers are paid only after your order is fulfilled.
      </p>
    </div>
  )
}
