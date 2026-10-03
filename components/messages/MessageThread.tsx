"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils/cn"
import { createClient } from "@/lib/supabase/client"
import { Avatar } from "@/components/messages/ConversationList"
import type { ConversationListItem } from "@/app/api/messages/conversations/route"
import type { Message } from "@/types/database"

export interface MessageThreadProps {
  conversation: ConversationListItem
  userId: string
  onBack: () => void
  onActivity: () => void
}

interface PendingMessage extends Message {
  pending?: boolean
  failed?: boolean
}

function formatTime(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

export function MessageThread({ conversation, userId, onBack, onActivity }: MessageThreadProps) {
  const [messages, setMessages] = useState<PendingMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const convId = conversation.id

  const markRead = useCallback(async () => {
    const supabase = createClient()
    const { error: err } = await supabase
      .from("messages")
      .update({ read: true })
      .eq("conversation_id", convId)
      .eq("receiver_id", userId)
      .eq("read", false)
    if (!err) onActivity()
  }, [convId, userId, onActivity])

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    const run = async () => {
      const { data, error: err } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, receiver_id, content, attachment_url, read, created_at")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true })
        .limit(500)
      if (cancelled) return
      if (err) setError("Could not load messages")
      else {
        setMessages((data ?? []) as Message[])
        void markRead()
      }
      setLoading(false)
    }
    void run()

    const channel = supabase
      .channel(`messages:${convId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` },
        (payload) => {
          const incoming = payload.new as Message
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev
            // Replace the optimistic copy of our own send, if any.
            const idx = prev.findIndex(
              (m) => m.pending && m.sender_id === incoming.sender_id && m.content === incoming.content,
            )
            if (idx >= 0) return prev.map((m, i) => (i === idx ? incoming : m))
            return [...prev, incoming]
          })
          if (incoming.receiver_id === userId) void markRead()
          onActivity()
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [convId, userId, markRead, onActivity])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [messages])

  const send = async () => {
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    setError(null)
    const tempId = `tmp-${Date.now()}`
    const optimistic: PendingMessage = {
      id: tempId,
      conversation_id: convId,
      sender_id: userId,
      receiver_id: conversation.other_user_id,
      content,
      attachment_url: null,
      read: false,
      created_at: new Date().toISOString(),
      pending: true,
    }
    setMessages((prev) => [...prev, optimistic])
    setDraft("")
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: convId, content }),
      })
      const json = (await res.json()) as { message?: Message; error?: string }
      if (!res.ok || !json.message) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        setDraft(content)
        setError(json.error ?? "Could not send message")
        return
      }
      const saved = json.message
      setMessages((prev) => {
        if (prev.some((m) => m.id === saved.id)) return prev.filter((m) => m.id !== tempId)
        return prev.map((m) => (m.id === tempId ? saved : m))
      })
      onActivity()
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setDraft(content)
      setError("Could not send message")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-border px-3 py-3">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} aria-label="Back to conversations" className="md:hidden">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar name={conversation.other_name} url={conversation.other_avatar_url} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">{conversation.other_name}</p>
          <p className="truncate font-mono text-xs uppercase tracking-[0.12em] text-text-muted">{conversation.context_label}</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
          </div>
        ) : messages.length === 0 ? (
          <p className="pt-10 text-center text-sm text-text-muted">No messages yet. Say hello.</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === userId
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg border px-3 py-2 sm:max-w-[70%]",
                    mine ? "border-accent-primary/30 bg-accent-primary/15" : "border-border bg-surface-elevated",
                    m.pending && "opacity-60",
                  )}
                >
                  <p className="whitespace-pre-wrap break-words text-sm text-text-primary">{m.content}</p>
                  <p className="mt-1 font-mono text-[11px] tabular-nums text-text-muted">{formatTime(m.created_at)}</p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p role="alert" className="border-t border-border px-3 py-2 text-sm text-accent-danger">
          {error}
        </p>
      )}

      <form
        className="flex items-end gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void send()
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder="Write a message…"
          aria-label="Message"
          className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
        />
        <Button type="submit" variant="aurora" size="sm" disabled={sending || draft.trim().length === 0} aria-label="Send message">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  )
}
