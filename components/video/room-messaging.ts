'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDataChannel, useLocalParticipant } from '@livekit/components-react'
import type { ReceivedDataMessage } from '@livekit/components-core'

/**
 * Single data-channel topic used for every in-room message this UI sends:
 * chat, reactions, and raise-hand state. `useDataChannel` narrows the
 * `message` it returns to whatever topic is passed in, so every envelope
 * below travels over this one topic and is told apart by its `kind`.
 */
const HAYESH_TOPIC = 'hayesh'

const MAX_MESSAGES = 200
const REACTION_LIFETIME_MS = 4000

/** A file shared in chat. The bytes live in the private `meeting-attachments`
 *  bucket; `path` is `<meeting_id>/<uploader_id>/<timestamp>-<name>` and is
 *  turned into a short-lived signed URL on click. */
export interface ChatAttachment {
  name: string
  path: string
  size: number
  mime: string
}

export interface ChatMessage {
  id: string
  text: string
  senderName: string
  at: number
  attachment?: ChatAttachment
}

/** A participant asking the host for permission to present (share screen). */
export interface PresentRequest {
  identity: string
  name: string
}

export type PresentRequestState = 'idle' | 'pending' | 'denied'

export interface TransientReaction {
  id: string
  emoji: string
  senderName: string
}

export interface ParticipantMeta {
  role?: string
  isHost?: boolean
}

type ChatEnvelope = {
  kind: 'chat'
  id: string
  text: string
  senderName: string
  at: number
  attachment?: ChatAttachment
}
type ReactionEnvelope = { kind: 'reaction'; emoji: string; senderName: string; at: number }
type HandEnvelope = { kind: 'hand'; raised: boolean }
type RecordingEnvelope = { kind: 'recording'; active: boolean }
type RequestPresentEnvelope = { kind: 'request-present'; name: string }
type PresentGrantedEnvelope = { kind: 'present-granted'; target: string }
type PresentDeniedEnvelope = { kind: 'present-denied'; target: string }
type RoomEnvelope =
  | ChatEnvelope
  | ReactionEnvelope
  | HandEnvelope
  | RecordingEnvelope
  | RequestPresentEnvelope
  | PresentGrantedEnvelope
  | PresentDeniedEnvelope

function isChatAttachment(value: unknown): value is ChatAttachment {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.name === 'string' &&
    typeof v.path === 'string' &&
    typeof v.size === 'number' &&
    typeof v.mime === 'string'
  )
}

/** Parses a LiveKit participant's `metadata` JSON string (set by
 *  app/api/livekit/token/route.ts as `{ role, isHost }`). Never throws —
 *  malformed or missing metadata just yields "no known role". */
export function parseParticipantMeta(metadata: string | undefined): ParticipantMeta {
  if (!metadata) return {}
  try {
    const parsed: unknown = JSON.parse(metadata)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const record = parsed as Record<string, unknown>
    const role = typeof record.role === 'string' ? record.role : undefined
    const isHost = typeof record.isHost === 'boolean' ? record.isHost : undefined
    return { role, isHost }
  } catch {
    return {}
  }
}

function isRoomEnvelope(value: unknown): value is RoomEnvelope {
  if (typeof value !== 'object' || value === null) return false
  const kind = (value as { kind?: unknown }).kind
  return (
    kind === 'chat' ||
    kind === 'reaction' ||
    kind === 'hand' ||
    kind === 'recording' ||
    kind === 'request-present' ||
    kind === 'present-granted' ||
    kind === 'present-denied'
  )
}

function decodeEnvelope(payload: Uint8Array): RoomEnvelope | null {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(payload))
    return isRoomEnvelope(parsed) ? parsed : null
  } catch {
    return null
  }
}

function encodeEnvelope(envelope: RoomEnvelope): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(envelope))
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export interface UseRoomMessagingReturn {
  messages: ChatMessage[]
  reactions: TransientReaction[]
  /** Keyed by participant identity. */
  handsRaised: Record<string, boolean>
  unreadCount: number
  sendChat: (text: string, attachment?: ChatAttachment) => void
  sendReaction: (emoji: string) => void
  raiseHand: (raised: boolean) => void
  /** Resets unreadCount to 0 — call when the chat sheet is opened. */
  markRead: () => void
  /** Room-wide recording indicator (last-writer-wins over the data channel). */
  isRecording: boolean
  /** Broadcasts the recording state to everyone and applies it locally. */
  broadcastRecording: (active: boolean) => void
  /** Host-side queue of pending "request to present" asks (oldest first). */
  presentRequests: PresentRequest[]
  /** True once a host/admin has allowed the local participant to present. */
  presentGranted: boolean
  /** Local state of this participant's own request. */
  presentRequestState: PresentRequestState
  /** Attendee: ask the host to present. */
  requestPresent: () => void
  /** Host/admin: allow a requester to present. */
  grantPresent: (identity: string) => void
  /** Host/admin: deny a requester. */
  denyPresent: (identity: string) => void
}

/**
 * Owns all realtime, non-media room communication (chat, emoji reactions,
 * raise-hand) over LiveKit's single data channel, topic "hayesh". Data
 * channel messages are never echoed back to their own sender, so every
 * "send*" function also applies the effect locally before/while publishing.
 */
export function useRoomMessaging(): UseRoomMessagingReturn {
  const { localParticipant } = useLocalParticipant()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [reactions, setReactions] = useState<TransientReaction[]>([])
  const [handsRaised, setHandsRaised] = useState<Record<string, boolean>>({})
  const [unreadCount, setUnreadCount] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [presentRequests, setPresentRequests] = useState<PresentRequest[]>([])
  const [presentGranted, setPresentGranted] = useState(false)
  const [presentRequestState, setPresentRequestState] = useState<PresentRequestState>('idle')

  const localIdentityRef = useRef(localParticipant.identity)
  useEffect(() => {
    localIdentityRef.current = localParticipant.identity
  }, [localParticipant.identity])

  const reactionTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const removeReaction = useCallback((id: string) => {
    setReactions((current) => current.filter((reaction) => reaction.id !== id))
    reactionTimeouts.current.delete(id)
  }, [])

  const scheduleReactionRemoval = useCallback(
    (id: string) => {
      const timeout = setTimeout(() => removeReaction(id), REACTION_LIFETIME_MS)
      reactionTimeouts.current.set(id, timeout)
    },
    [removeReaction]
  )

  const appendChatMessage = useCallback((message: ChatMessage) => {
    setMessages((current) => {
      const next = [...current, message]
      return next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next
    })
  }, [])

  const handleMessage = useCallback(
    (msg: ReceivedDataMessage<typeof HAYESH_TOPIC>) => {
      const envelope = decodeEnvelope(msg.payload)
      if (!envelope) return

      if (envelope.kind === 'chat') {
        appendChatMessage({
          id: envelope.id,
          text: envelope.text,
          senderName: envelope.senderName,
          at: envelope.at,
          attachment: isChatAttachment(envelope.attachment) ? envelope.attachment : undefined,
        })
        setUnreadCount((count) => count + 1)
        return
      }

      if (envelope.kind === 'request-present') {
        const requester = msg.from?.identity
        if (!requester) return
        setPresentRequests((current) =>
          current.some((r) => r.identity === requester)
            ? current
            : [...current, { identity: requester, name: msg.from?.name || envelope.name || requester }]
        )
        return
      }

      if (envelope.kind === 'present-granted' || envelope.kind === 'present-denied') {
        // Only honour decisions that come from the host or an admin, and only
        // when addressed to us (the sender also targets us, this is a backstop).
        const sender = parseParticipantMeta(msg.from?.metadata)
        const fromModerator = sender.isHost === true || sender.role === 'admin'
        if (!fromModerator || envelope.target !== localIdentityRef.current) return
        if (envelope.kind === 'present-granted') {
          setPresentGranted(true)
          setPresentRequestState('idle')
        } else {
          setPresentRequestState('denied')
        }
        return
      }

      if (envelope.kind === 'reaction') {
        const id = makeId('remote-reaction')
        setReactions((current) => [...current, { id, emoji: envelope.emoji, senderName: envelope.senderName }])
        scheduleReactionRemoval(id)
        return
      }

      if (envelope.kind === 'recording') {
        setIsRecording(envelope.active)
        return
      }

      // envelope.kind === 'hand'
      const identity = msg.from?.identity
      if (!identity) return
      setHandsRaised((current) => ({ ...current, [identity]: envelope.raised }))
    },
    [appendChatMessage, scheduleReactionRemoval]
  )

  const { send } = useDataChannel(HAYESH_TOPIC, handleMessage)

  // Clean up every pending "remove this reaction" timeout on unmount so
  // nothing tries to setState after the room interior has gone away.
  useEffect(() => {
    const timeouts = reactionTimeouts.current
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout))
      timeouts.clear()
    }
  }, [])

  const sendChat = useCallback(
    (text: string, attachment?: ChatAttachment) => {
      const trimmed = text.trim().slice(0, 500)
      if (!trimmed && !attachment) return
      const envelope: ChatEnvelope = {
        kind: 'chat',
        id: makeId(localParticipant.identity),
        text: trimmed,
        senderName: localParticipant.name || localParticipant.identity,
        at: Date.now(),
        ...(attachment ? { attachment } : {}),
      }
      void send(encodeEnvelope(envelope), { reliable: true })
      appendChatMessage({
        id: envelope.id,
        text: envelope.text,
        senderName: envelope.senderName,
        at: envelope.at,
        attachment,
      })
    },
    [appendChatMessage, localParticipant, send]
  )

  const sendReaction = useCallback(
    (emoji: string) => {
      const senderName = localParticipant.name || localParticipant.identity
      const envelope: ReactionEnvelope = { kind: 'reaction', emoji, senderName, at: Date.now() }
      void send(encodeEnvelope(envelope), { reliable: true })
      const id = makeId('local-reaction')
      setReactions((current) => [...current, { id, emoji, senderName }])
      scheduleReactionRemoval(id)
    },
    [localParticipant, scheduleReactionRemoval, send]
  )

  const raiseHand = useCallback(
    (raised: boolean) => {
      const envelope: HandEnvelope = { kind: 'hand', raised }
      void send(encodeEnvelope(envelope), { reliable: true })
      setHandsRaised((current) => ({ ...current, [localParticipant.identity]: raised }))
    },
    [localParticipant, send]
  )

  const markRead = useCallback(() => setUnreadCount(0), [])

  const broadcastRecording = useCallback(
    (active: boolean) => {
      const envelope: RecordingEnvelope = { kind: 'recording', active }
      void send(encodeEnvelope(envelope), { reliable: true })
      setIsRecording(active)
    },
    [send]
  )

  const requestPresent = useCallback(() => {
    const envelope: RequestPresentEnvelope = {
      kind: 'request-present',
      name: localParticipant.name || localParticipant.identity,
    }
    void send(encodeEnvelope(envelope), { reliable: true })
    setPresentRequestState('pending')
  }, [localParticipant, send])

  const grantPresent = useCallback(
    (identity: string) => {
      const envelope: PresentGrantedEnvelope = { kind: 'present-granted', target: identity }
      void send(encodeEnvelope(envelope), { reliable: true, destinationIdentities: [identity] })
      setPresentRequests((current) => current.filter((r) => r.identity !== identity))
    },
    [send]
  )

  const denyPresent = useCallback(
    (identity: string) => {
      const envelope: PresentDeniedEnvelope = { kind: 'present-denied', target: identity }
      void send(encodeEnvelope(envelope), { reliable: true, destinationIdentities: [identity] })
      setPresentRequests((current) => current.filter((r) => r.identity !== identity))
    },
    [send]
  )

  return {
    messages,
    reactions,
    handsRaised,
    unreadCount,
    sendChat,
    sendReaction,
    raiseHand,
    markRead,
    isRecording,
    broadcastRecording,
    presentRequests,
    presentGranted,
    presentRequestState,
    requestPresent,
    grantPresent,
    denyPresent,
  }
}
