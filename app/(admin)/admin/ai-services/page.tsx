"use client"

import { motion } from "framer-motion"
import { Cpu } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"

export default function AdminAIServicesPage() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-display font-bold text-text-primary">AI Service Builder</h2>
        <p className="text-text-muted">Create and manage HayeshAI Studio services.</p>
      </motion.div>

      <JarvisCard glow="green" className="p-8 text-center">
        <Cpu className="mx-auto h-12 w-12 text-accent-success mb-3" />
        <p className="text-text-muted">AI Service Builder coming soon. Configure models, prompts, input forms, and pricing.</p>
      </JarvisCard>
    </div>
  )
}
