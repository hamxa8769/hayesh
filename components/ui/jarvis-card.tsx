"use client"

import { type ReactNode } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils/cn"

interface JarvisCardProps {
  children: ReactNode
  className?: string
  glow?: "violet" | "cyan" | "green" | "none"
}

const glowColors = {
  violet: "shadow-[0_0_40px_rgba(108,99,255,0.15),inset_0_0_40px_rgba(108,99,255,0.05)]",
  cyan: "shadow-[0_0_40px_rgba(0,212,255,0.15),inset_0_0_40px_rgba(0,212,255,0.05)]",
  green: "shadow-[0_0_40px_rgba(0,255,148,0.15),inset_0_0_40px_rgba(0,255,148,0.05)]",
  none: "",
}

const borderGlow = {
  violet: "border-accent-primary/30 hover:border-accent-primary/60",
  cyan: "border-accent-secondary/30 hover:border-accent-secondary/60",
  green: "border-accent-success/30 hover:border-accent-success/60",
  none: "border-border",
}

export function JarvisCard({ children, className, glow = "violet" }: JarvisCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative rounded-2xl border bg-surface-elevated/60 backdrop-blur-xl",
        "before:absolute before:inset-0 before:rounded-2xl before:p-[1px]",
        "before:bg-gradient-to-br before:from-accent-primary/40 before:via-transparent before:to-accent-secondary/40",
        "before:-z-10 before:opacity-60",
        borderGlow[glow],
        glowColors[glow],
        "transition-all duration-500",
        className
      )}
    >
      {children}
    </motion.div>
  )
}
