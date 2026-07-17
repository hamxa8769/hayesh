"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Bot, RotateCcw, Send, X } from "lucide-react"
import type { UserRole } from "@/types/database"
import type { JarvisMessage, JarvisSuggestion } from "@/components/jarvis/jarvis-types"
import { JarvisMessageBubble } from "@/components/jarvis/JarvisMessageBubble"
import { JarvisSuggestions } from "@/components/jarvis/JarvisSuggestions"

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  teacher: "Teacher",
  parent: "Parent",
  seller: "Seller",
  buyer: "Buyer",
}

interface JarvisPanelProps {
  role: UserRole | undefined
  roleName: string | undefined
  suggestions: JarvisSuggestion[]
  messages: JarvisMessage[]
  isPending: boolean
  canRetry: boolean
  onSend: (query: string) => void
  onRetry: () => void
  onClose: () => void
  reducedMotion: boolean
}

export function JarvisPanel({
  role,
  roleName,
  suggestions,
  messages,
  isPending,
  canRetry,
  onSend,
  onRetry,
  onClose,
  reducedMotion,
}: JarvisPanelProps) {
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: reducedMotion ? "auto" : "smooth",
    })
  }, [messages, isPending, reducedMotion])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [input])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSend = () => {
    if (!input.trim() || isPending) return
    onSend(input)
    setInput("")
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = "auto"
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="false"
      aria-label="JARVIS assistant"
      initial={reducedMotion ? false : { opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 12 }}
      transition={reducedMotion ? { duration: 0 } : { type: "spring", damping: 26, stiffness: 320 }}
      style={{ transformOrigin: "bottom right" }}
      className="glass-strong fixed inset-x-4 bottom-24 top-20 z-[60] flex flex-col overflow-hidden rounded-lg border border-line-strong shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_30px_rgba(0,0,0,0.5)] sm:inset-auto sm:bottom-24 sm:right-6 sm:top-auto sm:h-[560px] sm:w-[380px]"
    >
      {/* header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent-primary/30 bg-surface">
            <Bot className="h-4 w-4 text-accent-primary" aria-hidden="true" />
          </div>
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              JARVIS
              <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
                {role ? ROLE_LABEL[role] : "Guest"}
              </span>
            </p>
            <p className="mt-0.5 truncate text-xs text-text-muted">
              {roleName ? `Signed in as ${roleName}` : "Your AI assistant"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close JARVIS assistant"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-surface-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <JarvisSuggestions
            suggestions={suggestions}
            onSelect={onSend}
            disabled={isPending}
            reducedMotion={reducedMotion}
          />
        ) : (
          messages.map((m) => <JarvisMessageBubble key={m.id} message={m} reducedMotion={reducedMotion} />)
        )}
        {isPending && (
          <div className="flex items-center gap-2 px-1" aria-live="polite">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface">
              <span className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-accent-primary"
                    animate={reducedMotion ? undefined : { opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </span>
            </div>
            <span className="text-xs text-text-muted">JARVIS is thinking…</span>
          </div>
        )}
        {canRetry && !isPending && (
          <div className="flex justify-start pl-8">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-text-muted transition-colors duration-150 hover:border-accent-primary/50 hover:text-text-primary"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Retry
            </button>
          </div>
        )}
      </div>

      {/* composer */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-lg border border-border bg-surface px-3 py-2 focus-within:border-accent-primary/60">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask JARVIS anything…"
            rows={1}
            disabled={isPending}
            aria-label="Message JARVIS"
            className="max-h-[120px] flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-disabled focus:outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isPending || !input.trim()}
            aria-label="Send message"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-primary text-white transition-opacity duration-150 hover:opacity-90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
