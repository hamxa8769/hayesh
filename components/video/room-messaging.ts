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

export interface ChatMessage {
  id: string
  text: string
  senderName: string
  at: number
}

export interface TransientReaction {
  id: string
  emoji: string
  senderName: string
}

export interface ParticipantMeta {
  role?: string
  isHost?: boolean
}

type ChatEnvelope = { kind: 'chat'; id: string; text: string; senderName: string; at: number }
type ReactionEnvelope = { kind: 'reaction'; emoji: string; senderName: string; at: number }
type HandEnvelope = { kind: 'hand'; raised: boolean }
type RoomEnvelope = ChatEnvelope | ReactionEnvelope | HandEnvelope

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
  return kind === 'chat' || kind === 'reaction' || kind === 'hand'
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
  sendChat: (text: string) => void
  sendReaction: (emoji: string) => void
  raiseHand: (raised: boolean) => void
  /** Resets unreadCount to 0 — call when the chat sheet is opened. */
  markRead: () => void
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
        appendChatMessage({ id: envelope.id, text: envelope.text, senderName: envelope.senderName, at: envelope.at })
        setUnreadCount((count) => count + 1)
        return
      }

      if (envelope.kind === 'reaction') {
        const id = makeId('remote-reaction')
        setReactions((current) => [...current, { id, emoji: envelope.emoji, senderName: envelope.senderName }])
        scheduleReactionRemoval(id)
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
    (text: string) => {
      const trimmed = text.trim().slice(0, 500)
      if (!trimmed) return
      const envelope: ChatEnvelope = {
        kind: 'chat',
        id: makeId(localParticipant.identity),
        text: trimmed,
        senderName: localParticipant.name || localParticipant.identity,
        at: Date.now(),
      }
      void send(encodeEnvelope(envelope), { reliable: true })
      appendChatMessage({ id: envelope.id, text: envelope.text, senderName: envelope.senderName, at: envelope.at })
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

  return { messages, reactions, handsRaised, unreadCount, sendChat, sendReaction, raiseHand, markRead }
}
