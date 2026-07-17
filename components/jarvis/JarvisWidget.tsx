"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Bot, X } from "lucide-react"
import { useSupabase } from "@/hooks/useSupabase"
import { JarvisPanel } from "@/components/jarvis/JarvisPanel"
import { useJarvisChat } from "@/components/jarvis/useJarvisChat"
import { getSuggestionsForRole } from "@/components/jarvis/jarvis-types"

/**
 * Floating JARVIS assistant. Mounted once in DashboardLayoutShell so it is
 * present on every authenticated role page (admin/teacher/parent/seller/buyer).
 * Talks to the existing /api/jarvis backend via useJarvisChat — see that
 * file for the exact request/response contract.
 */
export function JarvisWidget() {
  const { profile } = useSupabase()
  const [open, setOpen] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const chat = useJarvisChat()
  const launcherRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        launcherRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])

  const suggestions = getSuggestionsForRole(profile?.role)

  return (
    <>
      <motion.button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close JARVIS assistant" : "Open JARVIS assistant"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="glass fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full border border-accent-primary/30 text-text-primary shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-colors duration-150 hover:border-accent-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:bottom-6 sm:right-6"
        whileHover={prefersReducedMotion ? undefined : { scale: 1.05, y: -2 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
        animate={
          prefersReducedMotion || open
            ? {}
            : {
                boxShadow: [
                  "0 0 0 rgba(39,196,160,0)",
                  "0 0 22px rgba(39,196,160,0.35)",
                  "0 0 0 rgba(39,196,160,0)",
                ],
              }
        }
        transition={prefersReducedMotion ? undefined : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={prefersReducedMotion ? false : { rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={prefersReducedMotion ? undefined : { rotate: 90, opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
              className="flex"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={prefersReducedMotion ? false : { rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={prefersReducedMotion ? undefined : { rotate: -90, opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
              className="flex"
            >
              <Bot className="h-6 w-6 text-accent-primary" aria-hidden="true" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <JarvisPanel
            role={profile?.role}
            roleName={profile?.full_name}
            suggestions={suggestions}
            messages={chat.messages}
            isPending={chat.isPending}
            canRetry={chat.canRetry}
            onSend={chat.send}
            onRetry={chat.retry}
            onClose={() => setOpen(false)}
            reducedMotion={!!prefersReducedMotion}
          />
        )}
      </AnimatePresence>
    </>
  )
}
