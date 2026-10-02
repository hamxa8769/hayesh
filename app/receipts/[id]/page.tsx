import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { PrintButton } from "@/components/receipts/PrintButton"
import type { Transaction } from "@/types/database"

export const metadata: Metadata = {
  title: "Payment receipt",
  robots: { index: false, follow: false },
}

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer",
  ibft: "IBFT / Raast",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
  card: "Card",
  stripe: "Card (Stripe)",
}

const RECEIPT_STATUSES = ["completed", "processing", "refunded"] as const

interface PartyProfile {
  full_name: string | null
  email: string | null
}

function statusLabel(status: string | null): string {
  if (status === "processing") return "Paid — held in escrow"
  if (status === "refunded") return "Refunded"
  return "Paid"
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login?redirect=${encodeURIComponent(`/receipts/${id}`)}`)

  const { data } = await supabase.from("transactions").select("*").eq("id", id).maybeSingle()
  if (!data) notFound()
  const tx = data as Transaction

  const legalName = process.env.NEXT_PUBLIC_LEGAL_NAME ?? "Hayesh"
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL

  const isAvailable = (RECEIPT_STATUSES as readonly string[]).includes(tx.status ?? "")
  const isPayee = tx.payee_id === user.id && tx.payer_id !== user.id
  const currency = tx.currency === "USD" ? "USD" : "PKR"

  let payer: PartyProfile | null = null
  if (isAvailable && tx.payer_id) {
    const { data: p } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", tx.payer_id)
      .maybeSingle()
    payer = (p as PartyProfile | null) ?? null
  }

  const receiptNo = tx.reference_code ?? tx.id.slice(0, 8).toUpperCase()

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex justify-end print:hidden">
          {isAvailable && <PrintButton />}
        </div>

        <article className="rounded-lg border border-neutral-200 bg-white p-6 text-neutral-900 shadow-sm sm:p-10 print:rounded-none print:border-0 print:shadow-none">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-6">
            <div>
              <p className="text-2xl font-bold tracking-tight">Hayesh</p>
              <p className="mt-1 text-sm text-neutral-500">Payment receipt</p>
            </div>
            {isAvailable && (
              <div className="text-right text-sm">
                <p className="font-mono text-xs uppercase tracking-[0.12em] text-neutral-500">Receipt no.</p>
                <p className="font-mono font-semibold tabular-nums">{receiptNo}</p>
              </div>
            )}
          </header>

          {!isAvailable ? (
            <p className="py-12 text-center text-neutral-600">Receipt available once payment is confirmed.</p>
          ) : (
            <>
              <dl className="grid gap-6 py-6 sm:grid-cols-2">
                <div>
                  <dt className="font-mono text-xs uppercase tracking-[0.12em] text-neutral-500">Date paid</dt>
                  <dd className="mt-1 text-sm tabular-nums">
                    {tx.paid_at ? formatDate(tx.paid_at) : tx.created_at ? formatDate(tx.created_at) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-xs uppercase tracking-[0.12em] text-neutral-500">Status</dt>
                  <dd className="mt-1 text-sm font-medium">{statusLabel(tx.status)}</dd>
                </div>
                {tx.payer_id === user.id || payer ? (
                  <div>
                    <dt className="font-mono text-xs uppercase tracking-[0.12em] text-neutral-500">Billed to</dt>
                    <dd className="mt-1 text-sm">
                      {payer?.full_name ?? "Account holder"}
                      {payer?.email && <span className="block text-neutral-500">{payer.email}</span>}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="font-mono text-xs uppercase tracking-[0.12em] text-neutral-500">Payment method</dt>
                  <dd className="mt-1 text-sm">
                    {tx.payment_method ? (METHOD_LABELS[tx.payment_method] ?? tx.payment_method) : "—"}
                  </dd>
                </div>
                {tx.processor_ref && (
                  <div className="sm:col-span-2">
                    <dt className="font-mono text-xs uppercase tracking-[0.12em] text-neutral-500">
                      Processor reference
                    </dt>
                    <dd className="mt-1 break-all font-mono text-sm">{tx.processor_ref}</dd>
                  </div>
                )}
              </dl>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-y border-neutral-200 text-left">
                      <th className="py-2 font-mono text-xs font-normal uppercase tracking-[0.12em] text-neutral-500">
                        Description
                      </th>
                      <th className="py-2 text-right font-mono text-xs font-normal uppercase tracking-[0.12em] text-neutral-500">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-neutral-100">
                      <td className="py-3 pr-4">{tx.description ?? `${tx.type.replace("_", " ")} payment`}</td>
                      <td className="py-3 text-right font-mono tabular-nums">
                        {formatCurrency(tx.gross_amount, currency)}
                      </td>
                    </tr>
                    {isPayee && (
                      <>
                        <tr className="border-b border-neutral-100 text-neutral-600">
                          <td className="py-2 pr-4">Platform fee</td>
                          <td className="py-2 text-right font-mono tabular-nums">
                            − {formatCurrency(tx.platform_fee ?? 0, currency)}
                          </td>
                        </tr>
                        <tr className="font-semibold">
                          <td className="py-2 pr-4">Net to you</td>
                          <td className="py-2 text-right font-mono tabular-nums">
                            {formatCurrency(tx.net_amount, currency)}
                          </td>
                        </tr>
                      </>
                    )}
                    {!isPayee && (
                      <tr className="font-semibold">
                        <td className="py-3 pr-4">Total paid</td>
                        <td className="py-3 text-right font-mono tabular-nums">
                          {formatCurrency(tx.gross_amount, currency)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <footer className="mt-10 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
            <p>{legalName}</p>
            {supportEmail && <p className="mt-0.5">Questions? {supportEmail}</p>}
          </footer>
        </article>
      </div>
    </main>
  )
}
