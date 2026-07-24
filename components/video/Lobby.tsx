'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Hourglass } from 'lucide-react'

/**
 * Shown in place of RoomInterior while the local participant is connected to
 * the room but not yet admitted (meeting.waiting_room is true and the host
 * hasn't granted publish/subscribe permissions yet — see
 * components/video/VideoRoom.tsx). The LiveKit connection is already live in
 * the background so the host's ParticipantsSheet can see this participant
 * and admit them; this screen is purely the attendee-facing waiting state.
 */
export function Lobby() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-accent-primary/30 bg-accent-primary/10">
        <Hourglass className="h-6 w-6 text-accent-primary" />
        <motion.span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent-primary"
          animate={prefersReducedMotion ? { opacity: 0.8 } : { opacity: [0.4, 1, 0.4], scale: [1, 1.15, 1] }}
          transition={
            prefersReducedMotion ? undefined : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
          }
        />
      </div>

      <div className="space-y-1.5">
        <p className="font-display text-lg font-semibold text-text-primary">You&apos;re in the waiting room</p>
        <p className="max-w-xs text-sm text-text-muted">Waiting for the host to let you in&hellip;</p>
      </div>

      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-disabled">
        Your camera and mic stay off until you&apos;re admitted
      </p>
    </div>
  )
}
