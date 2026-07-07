"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { CreditCard, CheckCircle } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { useSupabase } from "@/hooks/useSupabase"
import { formatPKR, formatDate } from "@/lib/utils/format"
import type { Transaction } from "@/types/database"

export default function PaymentsPage() {
  const { user } = useSupabase()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetchData = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("payer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50)

      setTransactions((data || []) as Transaction[])
      setLoading(false)
    }
    fetchData()
  }, [user])

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-display font-bold text-text-primary">Payment History</h2>
      </motion.div>

      <JarvisCard glow="none" className="p-6">
        {loading ? (
          <p className="text-text-muted">Loading...</p>
        ) : transactions.length === 0 ? (
          <p className="text-text-muted text-center py-8">No payments yet</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-accent-success" />
                  <div>
                    <p className="text-sm font-medium text-text-primary capitalize">{tx.type} payment</p>
                    <p className="text-xs text-text-muted">{tx.created_at ? formatDate(tx.created_at) : "—"}</p>
                  </div>
                </div>
                <p className="font-mono text-sm font-bold text-text-primary">-{formatPKR(tx.gross_amount)}</p>
              </div>
            ))}
          </div>
        )}
      </JarvisCard>
    </div>
  )
}
