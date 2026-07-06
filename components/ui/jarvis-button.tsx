"use client"

import { forwardRef } from "react"
import { motion, type HTMLMotionProps } from "framer-motion"
import { cn } from "@/lib/utils/cn"

interface JarvisButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "sm" | "default" | "lg" | "xl"
  loading?: boolean
  glow?: boolean
  children?: React.ReactNode
}

const JarvisButton = forwardRef<HTMLButtonElement, JarvisButtonProps>(
  ({ className, variant = "primary", size = "default", loading = false, glow = true, children, disabled, ...props }, ref) => {
    const variants = {
      primary: "bg-accent-primary text-white hover:bg-accent-primary/90 hover:shadow-[0_0_30px_rgba(108,99,255,0.5)]",
      secondary: "bg-surface-elevated text-text-primary border border-border hover:border-accent-secondary/50 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]",
      ghost: "text-text-muted hover:text-text-primary hover:bg-surface-elevated",
      danger: "bg-accent-danger/20 text-accent-danger border border-accent-danger/30 hover:bg-accent-danger/30 hover:shadow-[0_0_20px_rgba(255,68,102,0.3)]",
    }

    const sizes = {
      sm: "h-8 px-3 text-xs rounded-md",
      default: "h-11 px-5 text-sm rounded-lg",
      lg: "h-12 px-7 text-base rounded-lg",
      xl: "h-14 px-10 text-lg rounded-xl",
    }

    return (
      <motion.button
        ref={ref}
        whileHover={glow && variant === "primary" ? { scale: 1.02 } : undefined}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "relative inline-flex items-center justify-center gap-2 font-medium transition-all duration-300",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/50",
          "disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </motion.button>
    )
  }
)
JarvisButton.displayName = "JarvisButton"

export { JarvisButton }
