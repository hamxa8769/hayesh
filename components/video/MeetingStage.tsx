'use client'

import { memo, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ParticipantTile,
  useConnectionQualityIndicator,
  useLocalParticipant,
  useParticipants,
  useSpeakingParticipants,
  useTracks,
} from '@livekit/components-react'
import { ConnectionQuality, Track } from 'livekit-client'
import type { Participant } from 'livekit-client'
import type { TrackReferenceOrPlaceholder } from '@livekit/components-core'
import { LayoutGrid, MicOff, Rows3 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { parseParticipantMeta } from '@/components/video/room-messaging'

export interface MeetingStageProps {
  /** Keyed by participant identity. */
  handsRaised: Record<string, boolean>
}

type StageView = 'speaker' | 'gallery'

const GALLERY_TILE_LIMIT = 9

function getTrackKey(trackRef: TrackReferenceOrPlaceholder): string {
  return `${trackRef.participant.identity}-${trackRef.source}`
}

/**
 * The video area: speaker view (pinned/loudest/first participant large, a
 * scrollable thumbnail strip below), gallery view (responsive grid), or
 * screen-share mode (screen fills the stage, local camera is a draggable
 * PiP) whenever anyone is sharing their screen.
 */
export function MeetingStage({ handsRaised }: MeetingStageProps) {
  const [view, setView] = useState<StageView>('speaker')
  const [pinnedIdentity, setPinnedIdentity] = useState<string | null>(null)

  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], { onlySubscribed: false })
  const participants = useParticipants()
  const speakingParticipants = useSpeakingParticipants()
  const { localParticipant } = useLocalParticipant()

  const screenShareTrack = useMemo(
    () => tracks.find((trackRef) => trackRef.source === Track.Source.ScreenShare),
    [tracks]
  )
  const cameraTracks = useMemo(() => tracks.filter((trackRef) => trackRef.source === Track.Source.Camera), [tracks])

  const localCameraTrack = useMemo(
    () => cameraTracks.find((trackRef) => trackRef.participant.identity === localParticipant.identity),
    [cameraTracks, localParticipant.identity]
  )

  const localPlaceholder: TrackReferenceOrPlaceholder = useMemo(
    () => ({ participant: localParticipant, source: Track.Source.Camera }),
    [localParticipant]
  )

  const mainTrack: TrackReferenceOrPlaceholder = useMemo(() => {
    if (pinnedIdentity) {
      const pinned = cameraTracks.find((trackRef) => trackRef.participant.identity === pinnedIdentity)
      if (pinned) return pinned
    }
    const loudest = speakingParticipants[0]
    if (loudest) {
      const loudestTrack = cameraTracks.find((trackRef) => trackRef.participant.identity === loudest.identity)
      if (loudestTrack) return loudestTrack
    }
    return cameraTracks[0] ?? localPlaceholder
  }, [cameraTracks, localPlaceholder, pinnedIdentity, speakingParticipants])

  const mainTrackKey = getTrackKey(mainTrack)
  const thumbnailTracks = useMemo(
    () => cameraTracks.filter((trackRef) => getTrackKey(trackRef) !== mainTrackKey),
    [cameraTracks, mainTrackKey]
  )

  const isScreenMode = Boolean(screenShareTrack)

  return (
    <div className="relative flex min-h-0 flex-1 flex-col p-2 sm:p-3">
      <div className="pointer-events-none absolute right-2 top-2 z-20 sm:right-3 sm:top-3">
        <div className="pointer-events-auto flex overflow-hidden rounded-full border border-border bg-surface/80 backdrop-blur">
          <button
            type="button"
            onClick={() => setView('speaker')}
            aria-label="Speaker view"
            aria-pressed={view === 'speaker'}
            className={cn(
              'flex h-10 w-10 items-center justify-center transition-colors',
              view === 'speaker' ? 'bg-accent-primary/15 text-accent-primary' : 'text-text-muted hover:text-text-primary'
            )}
          >
            <Rows3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView('gallery')}
            aria-label="Gallery view"
            aria-pressed={view === 'gallery'}
            className={cn(
              'flex h-10 w-10 items-center justify-center transition-colors',
              view === 'gallery' ? 'bg-accent-primary/15 text-accent-primary' : 'text-text-muted hover:text-text-primary'
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isScreenMode && screenShareTrack ? (
        <ScreenShareLayout
          screenShareTrack={screenShareTrack}
          localCameraTrack={localCameraTrack}
          handsRaised={handsRaised}
        />
      ) : view === 'gallery' ? (
        <GalleryLayout cameraTracks={cameraTracks} participants={participants} handsRaised={handsRaised} />
      ) : (
        <SpeakerLayout
          mainTrack={mainTrack}
          thumbnailTracks={thumbnailTracks}
          handsRaised={handsRaised}
          onPin={setPinnedIdentity}
        />
      )}
    </div>
  )
}

interface ScreenShareLayoutProps {
  screenShareTrack: TrackReferenceOrPlaceholder
  localCameraTrack: TrackReferenceOrPlaceholder | undefined
  handsRaised: Record<string, boolean>
}

function ScreenShareLayout({ screenShareTrack, localCameraTrack, handsRaised }: ScreenShareLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()

  return (
    <div
      ref={containerRef}
      className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-surface-elevated"
    >
      <StageTile trackRef={screenShareTrack} handRaised={false} className="h-full w-full" />
      {localCameraTrack && (
        <motion.div
          drag={!prefersReducedMotion}
          dragConstraints={containerRef}
          dragMomentum={false}
          className="absolute bottom-3 right-3 z-10 h-24 w-36 cursor-grab overflow-hidden rounded-lg border border-line-strong shadow-[0_8px_30px_rgba(0,0,0,0.5)] active:cursor-grabbing sm:h-28 sm:w-44"
        >
          <StageTile
            trackRef={localCameraTrack}
            handRaised={Boolean(handsRaised[localCameraTrack.participant.identity])}
            className="h-full w-full"
          />
        </motion.div>
      )}
    </div>
  )
}

interface SpeakerLayoutProps {
  mainTrack: TrackReferenceOrPlaceholder
  thumbnailTracks: TrackReferenceOrPlaceholder[]
  handsRaised: Record<string, boolean>
  onPin: (identity: string) => void
}

function SpeakerLayout({ mainTrack, thumbnailTracks, handsRaised, onPin }: SpeakerLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-surface-elevated">
        <StageTile
          trackRef={mainTrack}
          handRaised={Boolean(handsRaised[mainTrack.participant.identity])}
          className="h-full w-full"
        />
      </div>
      {thumbnailTracks.length > 0 && (
        <div className="flex shrink-0 gap-2 overflow-x-auto pb-1">
          {thumbnailTracks.map((trackRef) => (
            <button
              key={getTrackKey(trackRef)}
              type="button"
              onClick={() => onPin(trackRef.participant.identity)}
              aria-label={`Pin ${trackRef.participant.name || trackRef.participant.identity}`}
              className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-elevated transition-colors hover:border-line-strong sm:h-24 sm:w-40"
            >
              <StageTile
                trackRef={trackRef}
                handRaised={Boolean(handsRaised[trackRef.participant.identity])}
                className="h-full w-full"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface GalleryLayoutProps {
  cameraTracks: TrackReferenceOrPlaceholder[]
  participants: Participant[]
  handsRaised: Record<string, boolean>
}

function GalleryLayout({ cameraTracks, participants, handsRaised }: GalleryLayoutProps) {
  const visible = cameraTracks.slice(0, GALLERY_TILE_LIMIT)
  const overflowCount = Math.max(0, participants.length - visible.length)

  return (
    <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
      {visible.map((trackRef) => (
        <div
          key={getTrackKey(trackRef)}
          className="relative aspect-video overflow-hidden rounded-lg border border-border bg-surface-elevated"
        >
          <StageTile
            trackRef={trackRef}
            handRaised={Boolean(handsRaised[trackRef.participant.identity])}
            className="h-full w-full"
          />
        </div>
      ))}
      {overflowCount > 0 && (
        <div className="flex aspect-video items-center justify-center rounded-lg border border-border bg-surface-elevated font-mono text-sm text-text-muted">
          +{overflowCount} more
        </div>
      )}
    </div>
  )
}

interface StageTileProps {
  trackRef: TrackReferenceOrPlaceholder
  handRaised: boolean
  className?: string
}

/** Memoized so one participant's speaking/quality change doesn't force a
 *  re-render of every other tile in the grid or thumbnail strip. */
const StageTile = memo(function StageTile({ trackRef, handRaised, className }: StageTileProps) {
  const { quality } = useConnectionQualityIndicator({ participant: trackRef.participant })
  const meta = parseParticipantMeta(trackRef.participant.metadata)
  const roleBadge = meta.isHost ? 'Host' : meta.role ? meta.role.charAt(0).toUpperCase() + meta.role.slice(1) : null
  const displayName = trackRef.participant.name || trackRef.participant.identity

  return (
    <div className={cn('relative', className)}>
      <ParticipantTile trackRef={trackRef} className="h-full w-full" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-background/85 to-transparent px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-medium text-text-primary">{displayName}</span>
          {roleBadge && (
            <span className="shrink-0 whitespace-nowrap rounded-full border border-accent-primary/40 bg-accent-primary/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-accent-primary">
              {roleBadge}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {handRaised && (
            <span aria-label="Hand raised" title="Hand raised">
              ✋
            </span>
          )}
          {!trackRef.participant.isMicrophoneEnabled && (
            <MicOff className="h-3.5 w-3.5 text-accent-danger" aria-label="Microphone off" />
          )}
          <ConnectionBars quality={quality} />
        </div>
      </div>
    </div>
  )
})

function ConnectionBars({ quality }: { quality: ConnectionQuality }) {
  const barCount = quality === ConnectionQuality.Excellent ? 3 : quality === ConnectionQuality.Good ? 2 : 1
  const isPoor = quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost

  return (
    <div className="flex items-end gap-0.5" aria-label={`Connection quality: ${quality}`}>
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
