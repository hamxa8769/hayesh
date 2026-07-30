'use client'

import { memo, useMemo, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  ParticipantTile,
  useConnectionQualityIndicator,
  useIsSpeaking,
  useLocalParticipant,
  useTracks,
} from '@livekit/components-react'
import { ConnectionQuality, Track } from 'livekit-client'
import type { TrackReferenceOrPlaceholder } from '@livekit/components-core'
import { isTrackReferencePlaceholder } from '@livekit/components-core'
import { LayoutGrid, MicOff, Pin, PinOff } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Avatar } from '@/components/video/Avatar'
import { parseParticipantMeta } from '@/components/video/room-messaging'

export interface MeetingStageProps {
  /** Keyed by participant identity. */
  handsRaised: Record<string, boolean>
}

function getTrackKey(trackRef: TrackReferenceOrPlaceholder): string {
  return `${trackRef.participant.identity}-${trackRef.source}`
}

/** A camera track that is actually showing video (subscribed, published, not muted). */
function hasLiveVideo(trackRef: TrackReferenceOrPlaceholder): boolean {
  if (isTrackReferencePlaceholder(trackRef)) return false
  const pub = trackRef.publication
  return Boolean(pub && !pub.isMuted && pub.track)
}

/**
 * Single-focus call layout: ONE thing fills the stage at a time — the shared
 * screen (which takes over whenever anyone is presenting) or a focused
 * participant. Everyone else is a compact strip of round tiles floating over
 * the primary; tapping a round tile focuses that person. Optional grid view
 * for seeing everyone at once (hidden while a screen is shared).
 */
export function MeetingStage({ handsRaised }: MeetingStageProps) {
  const [pinnedIdentity, setPinnedIdentity] = useState<string | null>(null)
  const [showGrid, setShowGrid] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  )
  const { localParticipant } = useLocalParticipant()

  const screenShareTrack = useMemo(
    () => tracks.find((t) => t.source === Track.Source.ScreenShare),
    [tracks]
  )
  // One camera-or-placeholder ref per participant — the full roster.
  const cameraTiles = useMemo(() => tracks.filter((t) => t.source === Track.Source.Camera), [tracks])

  const localPlaceholder: TrackReferenceOrPlaceholder = useMemo(
    () => ({ participant: localParticipant, source: Track.Source.Camera }),
    [localParticipant]
  )

  const isScreenMode = Boolean(screenShareTrack)

  // The primary (big) tile when not screen-sharing.
  const primaryCamera: TrackReferenceOrPlaceholder = useMemo(() => {
    if (pinnedIdentity) {
      const pinned = cameraTiles.find((t) => t.participant.identity === pinnedIdentity)
      if (pinned) return pinned
    }
    const speaking = cameraTiles.find((t) => t.participant.isSpeaking && !t.participant.isLocal)
    if (speaking) return speaking
    return cameraTiles[0] ?? localPlaceholder
  }, [cameraTiles, localPlaceholder, pinnedIdentity])

  const primaryKey = isScreenMode && screenShareTrack ? getTrackKey(screenShareTrack) : getTrackKey(primaryCamera)

  // Filmstrip = everyone except whoever's currently the big camera. In screen
  // mode nobody is the "big camera", so the whole roster shows in the strip.
  const filmstripTiles = useMemo(() => {
    if (isScreenMode) return cameraTiles
    return cameraTiles.filter((t) => getTrackKey(t) !== primaryKey)
  }, [cameraTiles, isScreenMode, primaryKey])

  const focus = (identity: string) => {
    setPinnedIdentity(identity)
    setShowGrid(false)
  }

  if (showGrid && !isScreenMode) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col p-2 sm:p-3">
        <StageControls
          showGrid
          isScreenMode={false}
          onToggleGrid={() => setShowGrid((v) => !v)}
          pinned={Boolean(pinnedIdentity)}
          onUnpin={() => setPinnedIdentity(null)}
        />
        <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {cameraTiles.map((trackRef) => (
            <button
              key={getTrackKey(trackRef)}
              type="button"
              onClick={() => focus(trackRef.participant.identity)}
              className="relative aspect-video overflow-hidden rounded-lg border border-border bg-surface-elevated transition-colors hover:border-line-strong"
              aria-label={`Focus ${trackRef.participant.name || trackRef.participant.identity}`}
            >
              <StageTile trackRef={trackRef} handRaised={Boolean(handsRaised[trackRef.participant.identity])} avatarSize="md" />
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <StageControls
        showGrid={false}
        isScreenMode={isScreenMode}
        onToggleGrid={() => setShowGrid((v) => !v)}
        pinned={Boolean(pinnedIdentity)}
        onUnpin={() => setPinnedIdentity(null)}
      />

      {/* PRIMARY — fills the whole stage */}
      <div className="relative min-h-0 flex-1 bg-background">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={primaryKey}
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
            className="absolute inset-0"
          >
            {isScreenMode && screenShareTrack ? (
              <div data-screenshare className="relative h-full w-full">
                <style jsx>{`
                  div[data-screenshare] :global(video) {
                    object-fit: contain !important;
                    background: #000;
                  }
                `}</style>
                <ParticipantTile trackRef={screenShareTrack} disableSpeakingIndicator className="h-full w-full" />
                <div className="pointer-events-none absolute left-3 top-3">
                  <span className="rounded-full border border-border bg-surface/85 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-text-primary backdrop-blur">
                    {(screenShareTrack.participant.name || screenShareTrack.participant.identity) + ' is presenting'}
                  </span>
                </div>
              </div>
            ) : (
              <StageTile
                trackRef={primaryCamera}
                handRaised={Boolean(handsRaised[primaryCamera.participant.identity])}
                avatarSize="lg"
                className="h-full w-full rounded-none border-0"
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* ROUND FILMSTRIP — floats over the bottom of the primary */}
        {filmstripTiles.length > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-background/70 to-transparent px-2 pb-3 pt-8 sm:px-3">
            <div className="pointer-events-auto mx-auto flex max-w-full gap-2 overflow-x-auto pb-1">
              <AnimatePresence initial={false}>
                {filmstripTiles.map((trackRef) => (
                  <motion.button
                    key={getTrackKey(trackRef)}
                    layout={!prefersReducedMotion}
                    initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    type="button"
                    onClick={() => focus(trackRef.participant.identity)}
                    aria-label={`Focus ${trackRef.participant.name || trackRef.participant.identity}`}
                    className="shrink-0"
                  >
                    <RoundTile trackRef={trackRef} handRaised={Boolean(handsRaised[trackRef.participant.identity])} />
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface StageControlsProps {
  showGrid: boolean
  isScreenMode: boolean
  pinned: boolean
  onToggleGrid: () => void
  onUnpin: () => void
}

function StageControls({ showGrid, isScreenMode, pinned, onToggleGrid, onUnpin }: StageControlsProps) {
  return (
    <div className="pointer-events-none absolute right-2 top-2 z-30 flex gap-2 sm:right-3 sm:top-3">
      {pinned && !isScreenMode && (
        <button
          type="button"
          onClick={onUnpin}
          aria-label="Unpin — back to active speaker"
          className="pointer-events-auto flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface/85 px-3 text-xs text-text-muted backdrop-blur transition-colors hover:text-text-primary"
        >
          <PinOff className="h-3.5 w-3.5" /> Unpin
        </button>
      )}
      {!isScreenMode && (
        <button
          type="button"
          onClick={onToggleGrid}
          aria-label={showGrid ? 'Back to focus view' : 'Show everyone (grid)'}
          aria-pressed={showGrid}
          className={cn(
            'pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur transition-colors',
            showGrid
              ? 'border-accent-primary/40 bg-accent-primary/15 text-accent-primary'
              : 'border-border bg-surface/85 text-text-muted hover:text-text-primary'
          )}
        >
          {showGrid ? <Pin className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
        </button>
      )}
    </div>
  )
}

type AvatarSize = 'sm' | 'md' | 'lg'

interface StageTileProps {
  trackRef: TrackReferenceOrPlaceholder
  handRaised: boolean
  avatarSize?: AvatarSize
  className?: string
}

/** Rectangular tile with full overlays — used for the primary and grid tiles.
 *  Memoized; owns its own speaking/quality subscriptions. */
const StageTile = memo(function StageTile({ trackRef, handRaised, avatarSize = 'md', className }: StageTileProps) {
  const { quality } = useConnectionQualityIndicator({ participant: trackRef.participant })
  const isSpeaking = useIsSpeaking(trackRef.participant)
  const prefersReducedMotion = useReducedMotion()
  const meta = parseParticipantMeta(trackRef.participant.metadata)
  const roleBadge = meta.isHost ? 'Host' : meta.role ? meta.role.charAt(0).toUpperCase() + meta.role.slice(1) : null
  const displayName = trackRef.participant.name || trackRef.participant.identity
  const showVideo = hasLiveVideo(trackRef)

  return (
    <div
      className={cn(
        'relative h-full w-full overflow-hidden rounded-lg border transition-[border-color,box-shadow] duration-300',
        handRaised ? 'border-accent-warning/60' : 'border-transparent',
        isSpeaking && 'glow-violet border-accent-primary/60',
        className
      )}
    >
      {showVideo ? (
        <ParticipantTile trackRef={trackRef} disableSpeakingIndicator className="h-full w-full" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-surface-elevated">
          <Avatar name={displayName} size={avatarSize} />
        </div>
      )}

      {handRaised && (
        <motion.span
          initial={{ scale: 0.85, opacity: 0 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { scale: [1, 1.12, 1], opacity: 1 }}
          transition={
            prefersReducedMotion
              ? { duration: 0.15 }
              : { scale: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.2 } }
          }
          role="img"
          aria-label="Hand raised"
          className="absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-accent-warning/50 bg-surface/90 text-base shadow-[0_2px_10px_rgba(0,0,0,0.4)]"
        >
          ✋
        </motion.span>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-background/85 to-transparent px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium text-text-primary">{displayName}</span>
          {roleBadge && (
            <span className="shrink-0 whitespace-nowrap rounded-full border border-accent-primary/40 bg-accent-primary/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-accent-primary">
              {roleBadge}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!trackRef.participant.isMicrophoneEnabled && (
            <MicOff className="h-4 w-4 text-accent-danger" aria-label="Microphone off" />
          )}
          <ConnectionBars quality={quality} />
        </div>
      </div>
    </div>
  )
})

interface RoundTileProps {
  trackRef: TrackReferenceOrPlaceholder
  handRaised: boolean
}

/** Small CIRCULAR filmstrip tile. Memoized; owns its own speaking subscription. */
const RoundTile = memo(function RoundTile({ trackRef, handRaised }: RoundTileProps) {
  const isSpeaking = useIsSpeaking(trackRef.participant)
  const displayName = trackRef.participant.name || trackRef.participant.identity
  const showVideo = hasLiveVideo(trackRef)

  return (
    <div
      className={cn(
        'relative h-14 w-14 overflow-hidden rounded-full border-2 transition-colors sm:h-16 sm:w-16',
        handRaised ? 'border-accent-warning/70' : isSpeaking ? 'border-accent-primary' : 'border-border',
        isSpeaking && 'glow-violet'
      )}
      title={displayName}
    >
      {showVideo ? (
        <ParticipantTile trackRef={trackRef} disableSpeakingIndicator className="h-full w-full" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-surface-elevated">
          <Avatar name={displayName} size="sm" />
        </div>
      )}
      {handRaised && (
        <span role="img" aria-label="Hand raised" className="absolute -right-0.5 -top-0.5 text-xs">
          ✋
        </span>
      )}
      {!trackRef.participant.isMicrophoneEnabled && (
        <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-background/80">
          <MicOff className="h-2.5 w-2.5 text-accent-danger" aria-label="Microphone off" />
        </span>
      )}
    </div>
  )
})

function ConnectionBars({ quality }: { quality: ConnectionQuality }) {
  const barCount = quality === ConnectionQuality.Excellent ? 3 : quality === ConnectionQuality.Good ? 2 : 1
  const isPoor = quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost

  return (
    <div className="flex items-end gap-0.5" role="img" aria-label={`Connection quality: ${quality}`}>
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={cn(
            'w-0.5 rounded-sm',
            bar === 1 ? 'h-1.5' : bar === 2 ? 'h-2.5' : 'h-3.5',
            bar <= barCount ? (isPoor ? 'bg-accent-danger' : 'bg-accent-success') : 'bg-text-disabled/40'
          )}
        />
      ))}
    </div>
  )
}
