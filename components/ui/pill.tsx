import * as React from "react"
import { cn } from "@/lib/utils/cn"

export interface PillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

function Pill({ className, active = false, type = "button", ...props }: PillProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors duration-150",
        active
          ? "border-jade/50 text-jade bg-jade/10"
          : "border-line bg-surface-2 text-text-muted hover:border-line-strong hover:text-text",
        className
      )}
      {...props}
    />
  )
}

export { Pill }
