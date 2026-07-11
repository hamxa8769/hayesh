"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils/cn"
import type { LucideIcon } from "lucide-react"

interface JarvisRoleCardProps {
  icon: LucideIcon
  title: string
  description: string
  selected: boolean
  onClick: () => void
  glowColor?: "violet" | "cyan" | "green"
}

const glowMap = {
  violet: {
    border: "border-accent-primary/60",
    shadow: "shadow-[0_0_30px_rgba(39,196,160,0.3)]",
    icon: "text-accent-primary",
    bg: "bg-accent-primary/10",
  },
  cyan: {
    border: "border-accent-secondary/60",
    shadow: "shadow-[0_0_30px_rgba(245,184,78,0.3)]",
    icon: "text-accent-secondary",
    bg: "bg-accent-secondary/10",
  },
  green: {
    border: "border-accent-success/60",
    shadow: "shadow-[0_0_30px_rgba(52,211,153,0.3)]",
    icon: "text-accent-success",
    bg: "bg-accent-success/10",
  },
}

export function JarvisRoleCard({
  icon: Icon,
  title,
  description,
  selected,
  onClick,
  glowColor = "violet",
}: JarvisRoleCardProps) {
  const glow = glowMap[glowColor]

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-3 rounded-xl border p-5 text-center transition-all duration-300",
        "bg-surface/50 backdrop-blur-sm",
        selected
          ? cn(glow.border, glow.shadow, "bg-surface-elevated/80")
          : "border-border hover:border-border/80 hover:bg-surface-elevated/40"
      )}
    >
      {selected && (
        <motion.div
          layoutId="role-glow"
          className={cn(
            "absolute inset-0 rounded-xl opacity-20",
            glow.bg
          )}
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-lg transition-colors duration-300",
          selected ? glow.bg : "bg-surface-elevated"
        )}
      >
        <Icon
          className={cn(
            "h-6 w-6 transition-colors duration-300",
            selected ? glow.icon : "text-text-muted"
          )}
        />
      </div>
      <div>
        <p className={cn(
          "font-medium transition-colors duration-300",
          selected ? "text-text-primary" : "text-text-muted"
        )}>
          {title}
        </p>
        <p className="mt-1 text-xs text-text-disabled">{description}</p>
      </div>
    </motion.button>
  )
}
