"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils/cn"

interface BackButtonProps {
  /** Where to go when there is no in-app history (e.g. opened from an email link). */
  fallbackHref: string
  label?: string
  className?: string
}

/** Goes back one step in the app's history, or to `fallbackHref` on a fresh tab. */
export function BackButton({ fallbackHref, label = "Back", className }: BackButtonProps) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => {
        const cameFromApp = typeof document !== "undefined" && document.referrer.startsWith(window.location.origin)
        if (cameFromApp && window.history.length > 1) router.back()
        else router.push(fallbackHref)
      }}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text-primary",
        className
      )}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  )
}
