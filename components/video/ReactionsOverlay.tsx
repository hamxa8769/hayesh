'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { TransientReaction } from '@/components/video/room-messaging'

export interface ReactionsOverlayProps {
  reactions: TransientReaction[]
}

/**
 * Floating emoji reactions over the video stage. Purely presentational —
 * the parent (useRoomMessaging) owns the transient reactions array and
 * removes each entry ~4s after it appears; this component just animates
 * whatever is currently in the array.
 */
export function ReactionsOverlay({ reactions }: ReactionsOverlayProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      <AnimatePresence>
        {reactions.map((reaction, index) => (
          <motion.div
            key={reaction.id}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 0 }}
            animate={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: [0, 1, 1, 0], y: -180 }
            }
            exit={{ opacity: 0 }}
            transition={
              prefersReducedMotion
                ? { duration: 0.2 }
                : { duration: 4, ease: 'easeOut', times: [0, 0.12, 0.7, 1] }
            }
            className="absolute bottom-20 select-none text-4xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
            style={{ left: `${15 + ((index * 23) % 65)}%` }}
            aria-hidden="true"
          >
            {reaction.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
      <span className="sr-only" role="status">
        {reactions.length > 0
          ? `${reactions[reactions.length - 1]?.senderName} reacted with ${reactions[reactions.length - 1]?.emoji}`
          : ''}
      </span>
    </div>
  )
}
