"use client"

import { motion } from "framer-motion"
import { AlertTriangle } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"

export default function DisputesPage() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-2xl font-bold">Dispute Resolution</h2>
      </motion.div>
      <JarvisCard glow="none" className="p-8 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-text-disabled mb-3" />
        <p className="text-text-muted">No open disputes</p>
      </JarvisCard>
    </div>
  )
}
