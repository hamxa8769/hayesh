"use client"

import { useCallback, useEffect, useState } from "react"
import { Wallet } from "lucide-react"
import { StatTile } from "@/components/dashboard/StatTile"
import { PanelGroup } from "@/components/dashboard/PanelGroup"
import { Reveal } from "@/components/motion/Reveal"
import { Button } from "@/components/ui/button"
import { useSupabase } from "@/hooks/useSupabase"
import { formatPKR } from "@/lib/utils/format"
import { computeTeacherBalance, type TeacherBalance } from "@/components/teacher/teacher-balance"
import { monthlyEarnings } from "@/components/teacher/teacher-metrics"
import { EarningsAreaChart } from "@/components/teacher/EarningsAreaChart"
import { WithdrawalRequestModal } from "@/components/teacher/WithdrawalRequestModal"
import { WithdrawalHistoryTable } from "@/components/teacher/WithdrawalHistoryTable"
import { TeacherTransactionsTable } from "@/components/teacher/TeacherTransactionsTable"
import type { WithdrawalValues } from "@/components/teacher/withdrawal-schema"
import type { Transaction, Payout } from "@/types/database"

export default function EarningsPage() {
  const { user } = useSupabase()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [balance, setBalance] = useState<TeacherBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const [txRes, payoutRes] = await Promise.all([
      supabase.from("transactions").select("*").eq("payee_id", user.id).order("created_at", { ascending: false }),
      supabase.from("payouts").select("*").eq("recipient_id", user.id).order("created_at", { ascending: false }),
    ])
    const txs = (txRes.data || []) as Transaction[]
    const payoutRows = (payoutRes.data || []) as Payout[]
    setTransactions(txs)
    setPayouts(payoutRows)
    setBalance(computeTeacherBalance(txs, payoutRows))
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const handleWithdrawalSubmit = async (values: WithdrawalValues): Promise<{ error: string | null }> => {
    if (!user) return { error: "Not signed in" }
    try {
      // Bank details are sent to a server route (app/api/payouts/route.ts)
      // which encrypts account_number/iban before insert — the browser must
      // never write raw bank details straight into Postgres.
      const res = await fetch("/api/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: values.amount,
          currency: values.currency,
          payment_method: values.payment_method,
          bank_name: values.bank_name || undefined,
          account_number: values.account_number,
          iban: values.iban || undefined,
          notes: values.notes || undefined,
        }),
      })
      const json = (await res.json()) as { id?: string; error?: string }
      if (!res.ok) return { error: json.error || "Something went wrong. Please try again." }
      await load()
      return { error: null }
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Something went wrong. Please try again." }
    }
  }

  const completedTransactions = transactions.filter((t) => t.status === "completed")
  const chartData = monthlyEarnings(completedTransactions)

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text-primary">Earnings</h2>
          <Button variant="aurora" onClick={() => setModalOpen(true)} disabled={!balance || balance.available <= 0}>
            <Wallet className="h-4 w-4" /> Request Withdrawal
          </Button>
        </div>
      </Reveal>

      <PanelGroup className="grid gap-4 sm:grid-cols-3">
        <StatTile label="In Escrow" value={formatPKR(balance?.inEscrow ?? 0)} />
        <StatTile label="Available to Withdraw" value={formatPKR(balance?.available ?? 0)} accent />
        <StatTile label="Withdrawn" value={formatPKR(balance?.withdrawn ?? 0)} />
      </PanelGroup>

      <p className="text-sm text-text-muted">
        Funds from parent payments are held by Hayesh until a withdrawal request is reviewed and approved by an
        admin. Once approved, the amount is released to the payout method you provide below.
      </p>

      <PanelGroup title="Earnings, Last 6 Months">
        <EarningsAreaChart data={chartData} />
      </PanelGroup>

      <TeacherTransactionsTable transactions={transactions} loading={loading} />

      <WithdrawalHistoryTable payouts={payouts} loading={loading} />

      <WithdrawalRequestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        availableBalance={balance?.available ?? 0}
        onSubmit={handleWithdrawalSubmit}
      />
    </div>
  )
}
