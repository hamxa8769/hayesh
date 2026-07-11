import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils/cn"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-accent-primary/50",
  {
    variants: {
      variant: {
        default: "border-transparent bg-accent-primary/20 text-accent-primary",
        secondary: "border-transparent bg-surface-elevated text-text-muted",
        destructive: "border-transparent bg-accent-danger/20 text-accent-danger",
        outline: "border-border text-text-muted",
        success: "border-transparent bg-accent-success/20 text-accent-success",
        warning: "border-transparent bg-accent-warning/20 text-accent-warning",
        cyan: "border-transparent bg-accent-secondary/20 text-accent-secondary",
        aurora:
          "border-transparent text-[#08090C] font-semibold [background:linear-gradient(110deg,#27C4A0,#5AD1B0_40%,#F5B84E)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
