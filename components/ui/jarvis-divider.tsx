"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils/cn"

interface JarvisDividerProps {
  className?: string
  label?: string
}

export function JarvisDivider({ className, label }: JarvisDividerProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex-1 h-px bg-gradient-to-r from-transparent via-accent-primary/40 to-transparent"
        style={{ transformOrigin: "left" }}
      />
      {label && (
        <span className="text-xs text-text-disabled font-mono uppercase tracking-widest">
          {label}
        </span>
      )}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex-1 h-px bg-gradient-to-r from-transparent via-accent-primary/40 to-transparent"
        style={{ transformOrigin: "right" }}
      />
    </div>
  )
}
