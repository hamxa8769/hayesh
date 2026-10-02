'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Paperclip } from 'lucide-react'
import type { ChatMessage } from '@/components/video/room-messaging'

export interface ChatBubblesProps {
  messages: ChatMessage[]
  /** Hide the bubbles while the full chat sheet is open. */
  hidden?: boolean
}

const MAX_BUBBLES = 3
const BUBBLE_LIFETIME_MS = 8000

/**
 * Transient chat bubbles over the stage: the last few messages from the past
 * ~8s, so a host sees questions without opening the chat sheet. Anchored
 * mid-left (clear of the primary tile's bottom-left name pill and the bottom
 * filmstrip), non-interactive, and fades without transforms under
 * prefers-reduced-motion.
 */
export function ChatBubbles({ messages, hidden = false }: ChatBubblesProps) {
  const prefersReducedMotion = useReducedMotion()
  const [now, setNow] = useState(() => Date.now())

  // Tick only while something could still be visible.
  const newest = messages.length > 0 ? messages[messages.length - 1].at : 0
  useEffect(() => {
    setNow(Date.now())
    if (newest === 0) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    const stop = setTimeout(() => clearInterval(timer), BUBBLE_LIFETIME_MS + 1500)
    return () => {
      clearInterval(timer)
      clearTimeout(stop)
    }
  }, [newest])

  const visible = hidden ? [] : messages.filter((m) => now - m.at < BUBBLE_LIFETIME_MS).slice(-MAX_BUBBLES)

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-2 top-1/2 z-10 flex max-w-[70%] -translate-y-1/2 flex-col items-start gap-1.5 sm:left-3 sm:max-w-sm"
    >
      <AnimatePresence initial={false}>
        {visible.map((message) => (
          <motion.div
            key={message.id}
            layout={!prefersReducedMotion}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="max-w-full rounded-lg border border-line-strong bg-surface/85 px-3 py-1.5 text-sm shadow-[0_4px_16px_rgba(0,0,0,0.4)] backdrop-blur"
          >
            <span className="font-semibold text-text-primary">{message.senderName}</span>
            <span className="ml-2 break-words text-text-muted">
              {message.attachment ? (
                <span className="inline-flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  {message.attachment.name}
                </span>
              ) : (
                message.text.slice(0, 140)
              )}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
