"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface FilterSheetProps {
  open: boolean
  onClose: () => void
  resultCount: number
  children: ReactNode
}

/** Mobile bottom sheet: focus moves in, Escape/backdrop close, focus returns, body scroll locked. */
export function FilterSheet({ open, onClose, resultCount, children }: FilterSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70] lg:hidden">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-lg border-t border-line-strong bg-background outline-none"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-display text-lg font-semibold text-text-primary">Filters</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-surface-elevated hover:text-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5">{children}</div>
        <div className="border-t border-border p-4">
          <Button onClick={onClose} className="w-full">
            Show {resultCount} {resultCount === 1 ? "result" : "results"}
          </Button>
        </div>
      </div>
    </div>
  )
}
