"use client"

import { motion } from "framer-motion"
import { Globe } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"

export default function AdminTranslationPage() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-display font-bold text-text-primary">Translation Management</h2>
      </motion.div>
      <JarvisCard glow="none" className="p-8 text-center">
        <Globe className="mx-auto h-12 w-12 text-text-disabled mb-3" />
        <p className="text-text-muted">Per-teacher translation toggle and language settings coming soon.</p>
      </JarvisCard>
    </div>
  )
}
