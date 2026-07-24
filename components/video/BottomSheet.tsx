'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'

export interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
}

/**
 * Mobile-style sheet that slides up from the bottom of the (relatively
 * positioned) room container, capped at 70% height. Used by ChatSheet and
 * ParticipantsSheet so the video stage stays visible above it. Traps focus,
 * closes on Escape or backdrop click, and restores focus to whatever was
 * focused before it opened.
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const prefersReducedMotion = useReducedMotion()
  const sheetRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const sheet = sheetRef.current
    if (sheet) {
      const focusable = getFocusableElements(sheet)
      ;(focusable[0] ?? sheet).focus()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !sheet) return

      const focusable = getFocusableElements(sheet)
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocusedRef.current?.focus()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Transparent click-outside-to-close layer — no dimming, so the
              video stage stays fully visible above the sheet. */}
          <motion.button
            type="button"
            aria-label="Close"
            onClick={onClose}
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 1 }}
            className="absolute inset-0 z-30 cursor-default"
          />
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={prefersReducedMotion ? { opacity: 0 } : { y: '100%' }}
            animate={prefersReducedMotion ? { opacity: 1 } : { y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { y: '100%' }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="glass absolute inset-x-0 bottom-0 z-40 flex max-h-[70%] flex-col rounded-t-2xl border-t border-line-strong outline-none"
          >
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-text-disabled/40" aria-hidden="true" />
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <p className="truncate font-display text-sm font-semibold text-text-primary">{title}</p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
