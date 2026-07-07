"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { CreditCard } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { useSupabase } from "@/hooks/useSupabase"
import { formatPKR, formatDate } from "@/lib/utils/format"
import type { Transaction } from "@/types/database"

export default function PaymentsPage() {
  const { user } = useSupabase()
  const [txs, setTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data } = await supabase.from("transactions").select("*").eq("payer_id", user.id).order("created_at", { ascending: false })
      setTxs((data || []) as Transaction[])
      setLoading(false)
    }
    load()
  }, [user])

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-2xl font-bold">Payment History</h2>
      </motion.div>

      {loading ? <p className="text-text-muted">Loading...</p> : txs.length === 0 ? (
        <JarvisCard glow="none" className="p-8 text-center">
          <CreditCard className="mx-auto h-12 w-12 text-text-disabled mb-3" />
          <p className="text-text-muted">No payments yet</p>
        </JarvisCard>
      ) : (
        <JarvisCard glow="none" className="p-6">
          <div className="space-y-2">
            {txs.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm text-text-primary">{tx.type}</p>
                  <p className="text-xs text-text-muted">{tx.created_at ? formatDate(tx.created_at) : ""}</p>
                </div>
                <span className="font-mono text-sm font-bold text-accent-danger">-{formatPKR(tx.gross_amount || 0)}</span>
              </div>
            ))}
          </div>
        </JarvisCard>
      )}
    </div>
  )
}
