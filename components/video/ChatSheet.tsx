'use client'

import { useEffect, useRef, useState } from 'react'
import { FileText, Loader2, Paperclip, Send, Smile } from 'lucide-react'
import { BottomSheet } from '@/components/video/BottomSheet'
import type { ChatAttachment, ChatMessage } from '@/components/video/room-messaging'
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_BUCKET,
  buildAttachmentPath,
  formatBytes,
  resolveAttachmentMime,
  toChatAttachment,
  validateAttachment,
} from '@/components/video/chat-attachments'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'

export interface ChatSheetProps {
  open: boolean
  onClose: () => void
  messages: ChatMessage[]
  onSend: (text: string, attachment?: ChatAttachment) => void
  /** The meeting uuid — scopes attachment uploads and downloads. */
  meetingId: string
}

const MAX_CHAT_LENGTH = 500

const EMOJI_GRID = [
  '😀', '😂', '🙂', '😉', '😊', '😍', '🤔', '😅',
  '😮', '😢', '😭', '😎', '🙌', '👍', '👎', '👏',
  '🙏', '💪', '👌', '🤝', '👋', '✅', '❌', '❓',
  '❗', '🔥', '⭐', '💯', '🎉', '❤️', '💡', '📌',
  '📎', '📚', '✏️', '🕒', '☕', '🚀', '👀', '😴',
]

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ChatSheet({ open, onClose, messages, onSend, meetingId }: ChatSheetProps) {
  const [draft, setDraft] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [openingPath, setOpeningPath] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const listEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to the newest message whenever the list grows while open.
  useEffect(() => {
    if (!open) return
    listEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, open])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(t)
  }, [notice])

  useEffect(() => {
    if (!open) setEmojiOpen(false)
  }, [open])

  const handleSend = () => {
    const trimmed = draft.trim()
    if (!trimmed) return
    onSend(trimmed.slice(0, MAX_CHAT_LENGTH))
    setDraft('')
  }

  const insertEmoji = (emoji: string) => {
    const input = inputRef.current
    const start = input?.selectionStart ?? draft.length
    const end = input?.selectionEnd ?? draft.length
    const next = (draft.slice(0, start) + emoji + draft.slice(end)).slice(0, MAX_CHAT_LENGTH)
    const caret = Math.min(start + emoji.length, next.length)
    setDraft(next)
    // Restore focus + caret after React commits the new value.
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(caret, caret)
    })
  }

  const handleFileChosen = async (file: File | undefined) => {
    if (!file) return
    const problem = validateAttachment(file)
    if (problem) {
      setNotice(problem)
      return
    }
    const mime = resolveAttachmentMime(file)
    if (!mime) return
    setUploading(true)
    setNotice(null)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setNotice('Please sign in again to share files.')
        return
      }
      const path = buildAttachmentPath(meetingId, user.id, file.name)
      const { error } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(path, file, { contentType: mime, upsert: false })
      if (error) {
        setNotice('Upload failed. Please try again.')
        return
      }
      onSend('', toChatAttachment(path, file, mime))
    } catch {
      setNotice('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const openAttachment = async (attachment: ChatAttachment) => {
    setOpeningPath(attachment.path)
    setNotice(null)
    try {
      const response = await fetch(`/api/meetings/${meetingId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: attachment.path }),
      })
      const data: { url?: string; error?: string } = await response.json()
      if (!response.ok || !data.url) {
        setNotice(data.error ?? 'Could not open that file.')
        return
      }
      const link = document.createElement('a')
      link.href = data.url
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch {
      setNotice('Network error — could not open that file.')
    } finally {
      setOpeningPath(null)
    }
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
                {message.text && <p className="break-words text-sm text-text-muted">{message.text}</p>}
                {message.attachment && (
                  <button
                    type="button"
                    onClick={() => message.attachment && void openAttachment(message.attachment)}
                    disabled={openingPath === message.attachment.path}
                    className="mt-1 flex w-full max-w-xs items-center gap-2 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-left transition-colors hover:border-line-strong disabled:opacity-60"
                  >
                    {openingPath === message.attachment.path ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent-primary" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0 text-accent-primary" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-text-primary">{message.attachment.name}</span>
                      <span className="block font-mono text-[10px] tabular-nums text-text-muted">
                        {formatBytes(message.attachment.size)}
                      </span>
                    </span>
                  </button>
                )}
              </div>
            ))
          )}
          <div ref={listEndRef} />
        </div>

        {notice && (
          <p role="alert" className="mx-3 mb-1 rounded-md border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-xs text-accent-danger">
            {notice}
          </p>
        )}

        {emojiOpen && (
          <div
            role="group"
            aria-label="Emoji picker"
            className="mx-3 mb-1 grid grid-cols-8 gap-0.5 rounded-lg border border-line-strong bg-surface p-1.5"
          >
            {EMOJI_GRID.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => insertEmoji(emoji)}
                aria-label={`Insert ${emoji}`}
                className="flex h-9 items-center justify-center rounded-md text-xl transition-colors hover:bg-surface-elevated"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-3">
          <input
            ref={fileInputRef}
            type="file"
            accept={ATTACHMENT_ACCEPT}
            className="hidden"
            onChange={(event) => void handleFileChosen(event.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Attach a file"
            className="flex h-12 w-10 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:text-text-primary disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => setEmojiOpen((current) => !current)}
            aria-label="Insert emoji"
            aria-expanded={emojiOpen}
            className={cn(
              'flex h-12 w-10 shrink-0 items-center justify-center rounded-full transition-colors',
              emojiOpen ? 'text-accent-primary' : 'text-text-muted hover:text-text-primary'
            )}
          >
            <Smile className="h-5 w-5" />
          </button>
          <input
            ref={inputRef}
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
            className="h-12 min-w-0 flex-1 rounded-lg border border-border bg-surface-elevated px-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none"
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
