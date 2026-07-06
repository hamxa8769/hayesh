"use client"

import { forwardRef, useState } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils/cn"

interface JarvisInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

const JarvisInput = forwardRef<HTMLInputElement, JarvisInputProps>(
  ({ className, label, error, icon, type, ...props }, ref) => {
    const [focused, setFocused] = useState(false)

    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-sm font-medium text-text-muted flex items-center gap-2">
            {icon && <span className="text-accent-primary">{icon}</span>}
            {label}
          </label>
        )}
        <div className="relative">
          {focused && (
            <motion.div
              layoutId="input-glow"
              className="absolute -inset-[1px] rounded-lg bg-gradient-to-r from-accent-primary/30 via-accent-secondary/20 to-accent-primary/30 blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            />
          )}
          <input
            type={type}
            ref={ref}
            className={cn(
              "relative flex h-11 w-full rounded-lg border bg-surface/80 px-4 py-2 text-sm text-text-primary",
              "placeholder:text-text-disabled",
              "transition-all duration-300",
              "focus:outline-none focus:border-accent-primary/60",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error ? "border-accent-danger/60" : "border-border",
              className
            )}
            onFocus={(e) => {
              setFocused(true)
              props.onFocus?.(e)
            }}
            onBlur={(e) => {
              setFocused(false)
              props.onBlur?.(e)
            }}
            {...props}
          />
        </div>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-accent-danger"
          >
            {error}
          </motion.p>
        )}
      </div>
    )
  }
)
JarvisInput.displayName = "JarvisInput"

export { JarvisInput }
