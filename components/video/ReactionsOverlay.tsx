'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { TransientReaction } from '@/components/video/room-messaging'

export interface ReactionsOverlayProps {
  reactions: TransientReaction[]
}

const REACTION_DURATION_S = 3.6

/** Deterministic pseudo-random value in [0, 1) derived from a reaction's id,
 *  so its horizontal position/drift stays fixed for its whole lifetime even
 *  though this list re-renders whenever a sibling reaction mounts/unmounts —
 *  Math.random() here would make it jump around on every render. */
function seededRandom(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }
  return (Math.abs(hash) % 1000) / 1000
}

/**
 * Floating emoji reactions over the video stage. Purely presentational —
 * the parent (useRoomMessaging) owns the transient reactions array and
 * removes each entry ~4s after it appears; this component just animates
 * whatever is currently in the array. Each reaction gets a stable, hashed
 * horizontal slot + drift so several at once spread across the stage
 * instead of stacking on top of one another.
 */
export function ReactionsOverlay({ reactions }: ReactionsOverlayProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      <AnimatePresence mode="popLayout">
        {reactions.map((reaction) => {
          const seed = seededRandom(reaction.id)
          const leftPercent = 12 + seed * 70
          const driftPx = (seed - 0.5) * 80

          return (
            <motion.div
              key={reaction.id}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 0, y: 0, scale: 0.6 }}
              animate={
                prefersReducedMotion
                  ? { opacity: 1 }
                  : { opacity: [0, 1, 1, 0], x: driftPx, y: -220, scale: [0.6, 1.15, 1, 1] }
              }
              exit={{ opacity: 0 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0.25 }
                  : { duration: REACTION_DURATION_S, ease: 'easeOut', times: [0, 0.15, 0.75, 1] }
              }
              className="absolute bottom-16 flex select-none flex-col items-center gap-1"
              style={{ left: `${leftPercent}%` }}
              aria-hidden="true"
            >
              <span className="text-3xl drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] sm:text-4xl">{reaction.emoji}</span>
              <span className="whitespace-nowrap rounded-full border border-border bg-surface/85 px-2 py-0.5 font-mono text-[10px] text-text-muted backdrop-blur">
                {reaction.senderName}
              </span>
            </motion.div>
          )
        })}
      </AnimatePresence>
      <span className="sr-only" role="status">
        {reactions.length > 0
          ? `${reactions[reactions.length - 1]?.senderName} reacted with ${reactions[reactions.length - 1]?.emoji}`
          : ''}
      </span>
    </div>
  )
}
