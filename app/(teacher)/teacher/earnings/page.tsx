"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Wallet, TrendingUp, ArrowDownLeft } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { useSupabase } from "@/hooks/useSupabase"
import { formatPKR, formatDate } from "@/lib/utils/format"
import type { Transaction } from "@/types/database"

export default function EarningsPage() {
  const { user } = useSupabase()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetchEarnings = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("payee_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(50)

      setTransactions((data || []) as Transaction[])
      const total = (data || []).reduce((sum, t) => sum + (t.net_amount || 0), 0)
      setTotalEarnings(total)
      setLoading(false)
    }
    fetchEarnings()
  }, [user])

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-display font-bold text-text-primary">Earnings</h2>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <JarvisCard glow="violet" className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-muted">Total Earnings</p>
                <p className="mt-1 font-mono text-2xl font-bold text-accent-success">{formatPKR(totalEarnings)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-accent-success opacity-50" />
            </div>
          </JarvisCard>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <JarvisCard glow="none" className="p-5">
            <p className="text-sm text-text-muted">Available Balance</p>
            <p className="mt-1 font-mono text-2xl font-bold text-text-primary">{formatPKR(totalEarnings)}</p>
          </JarvisCard>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <JarvisCard glow="none" className="p-5">
            <p className="text-sm text-text-muted">Transactions</p>
            <p className="mt-1 font-mono text-2xl font-bold text-text-primary">{transactions.length}</p>
          </JarvisCard>
        </motion.div>
      </div>

      <JarvisCard glow="none" className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold text-text-primary">Transaction History</h3>
          <JarvisButton variant="secondary" size="sm">Request Payout</JarvisButton>
        </div>
        {loading ? (
          <p className="text-text-muted">Loading...</p>
        ) : transactions.length === 0 ? (
          <p className="text-text-muted text-center py-8">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <ArrowDownLeft className="h-4 w-4 text-accent-success" />
                  <div>
                    <p className="text-sm font-medium text-text-primary capitalize">{tx.type}</p>
                    <p className="text-xs text-text-muted">{tx.created_at ? formatDate(tx.created_at) : "—"}</p>
                  </div>
                </div>
                <p className="font-mono text-sm font-bold text-accent-success">+{formatPKR(tx.net_amount)}</p>
              </div>
            ))}
          </div>
        )}
      </JarvisCard>
    </div>
  )
}
