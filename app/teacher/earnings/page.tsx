"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Wallet } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { useSupabase } from "@/hooks/useSupabase"
import { formatPKR, formatDate } from "@/lib/utils/format"
import type { Transaction } from "@/types/database"

export default function EarningsPage() {
  const { user } = useSupabase()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data } = await supabase.from("transactions").select("*").eq("payee_id", user.id).order("created_at", { ascending: false })
      const txs = (data || []) as Transaction[]
      setTransactions(txs)
      setBalance(txs.filter((t) => t.status === "completed").reduce((s, t) => s + (t.net_amount || 0), 0))
      setLoading(false)
    }
    load()
  }, [user])

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-2xl font-bold">Earnings</h2>
      </motion.div>

      <JarvisCard glow="green" className="p-6">
        <p className="text-sm text-text-muted">Available Balance</p>
        <p className="mt-1 font-mono text-3xl font-bold text-accent-success">{formatPKR(balance)}</p>
      </JarvisCard>

      {loading ? (
        <p className="text-text-muted">Loading...</p>
      ) : transactions.length === 0 ? (
        <JarvisCard glow="none" className="p-8 text-center">
          <Wallet className="mx-auto h-12 w-12 text-text-disabled mb-3" />
          <p className="text-text-muted">No transactions yet</p>
        </JarvisCard>
      ) : (
        <JarvisCard glow="none" className="p-6">
          <h3 className="mb-4 font-display text-lg font-bold">Transaction History</h3>
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm text-text-primary">{tx.type}</p>
                  <p className="text-xs text-text-muted">{tx.created_at ? formatDate(tx.created_at) : ""}</p>
                </div>
                <span className="font-mono text-sm font-bold text-accent-success">{formatPKR(tx.net_amount || 0)}</span>
              </div>
            ))}
          </div>
        </JarvisCard>
      )}
    </div>
  )
}
