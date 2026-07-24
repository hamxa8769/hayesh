'use client'

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { BottomSheet } from '@/components/video/BottomSheet'
import type { ChatMessage } from '@/components/video/room-messaging'
import { cn } from '@/lib/utils/cn'

export interface ChatSheetProps {
  open: boolean
  onClose: () => void
  messages: ChatMessage[]
  onSend: (text: string) => void
}

const MAX_CHAT_LENGTH = 500

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ChatSheet({ open, onClose, messages, onSend }: ChatSheetProps) {
  const [draft, setDraft] = useState('')
  const listEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to the newest message whenever the list grows while open.
  useEffect(() => {
    if (!open) return
    listEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, open])

  const handleSend = () => {
    const trimmed = draft.trim()
    if (!trimmed) return
    onSend(trimmed.slice(0, MAX_CHAT_LENGTH))
    setDraft('')
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Chat">
      <div className="flex h-full min-h-[16rem] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">No messages yet.</p>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="flex flex-col gap-0.5">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-xs font-semibold text-text-primary">{message.senderName}</span>
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-text-disabled">
                    {formatTime(message.at)}
                  </span>
                </div>
                <p className="break-words text-sm text-text-muted">{message.text}</p>
              </div>
            ))
          )}
          <div ref={listEndRef} />
        </div>
        <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-3">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, MAX_CHAT_LENGTH))}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              handleSend()
            }}
            placeholder="Message everyone…"
            maxLength={MAX_CHAT_LENGTH}
            aria-label="Chat message"
            className="h-12 flex-1 rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={draft.trim().length === 0}
            aria-label="Send message"
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors',
              draft.trim().length === 0
                ? 'bg-surface-elevated text-text-disabled'
                : 'bg-accent-primary text-white hover:bg-accent-primary/90'
            )}
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
