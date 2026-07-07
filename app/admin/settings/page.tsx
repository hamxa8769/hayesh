"use client"

import { motion } from "framer-motion"
import { Settings } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-2xl font-bold">Platform Settings</h2>
      </motion.div>
      <JarvisCard glow="none" className="p-8 text-center">
        <Settings className="mx-auto h-12 w-12 text-text-disabled mb-3" />
        <p className="text-text-muted">Platform settings coming soon</p>
      </JarvisCard>
    </div>
  )
}
