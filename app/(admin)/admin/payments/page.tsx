"use client"

import { motion } from "framer-motion"
import { Wallet } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"

export default function AdminPaymentsPage() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-display font-bold text-text-primary">Payments & Payouts</h2>
      </motion.div>
      <JarvisCard glow="none" className="p-8 text-center">
        <Wallet className="mx-auto h-12 w-12 text-text-disabled mb-3" />
        <p className="text-text-muted">Revenue dashboard, transaction ledger, and payout processing coming soon.</p>
      </JarvisCard>
    </div>
  )
}
