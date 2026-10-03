"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Loader2, MessageSquare, LifeBuoy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils/cn"
import { ConversationList } from "@/components/messages/ConversationList"
import { MessageThread } from "@/components/messages/MessageThread"
import type { ConversationListItem, ConversationListResponse } from "@/app/api/messages/conversations/route"

export function MessagesHub() {
  const [items, setItems] = useState<ConversationListItem[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch("/api/messages/conversations", { cache: "no-store" })
      const json = (await res.json()) as Partial<ConversationListResponse> & { error?: string }
      if (!res.ok || !json.items || !json.user_id) {
        setError(json.error ?? "Could not load conversations")
        return
      }
      setError(null)
      setItems(json.items)
      setUserId(json.user_id)
    } catch {
      setError("Could not load conversations")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const c = new URLSearchParams(window.location.search).get("c")
    if (c) setActiveId(c)
  }, [load])

  const select = (id: string | null) => {
    setActiveId(id)
    const url = id ? `/messages?c=${id}` : "/messages"
    window.history.replaceState(null, "", url)
  }

  const openSupport = async () => {
    setOpening(true)
    setError(null)
    try {
      const res = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ support: true }),
      })
      const json = (await res.json()) as { conversation_id?: string; error?: string }
      if (!res.ok || !json.conversation_id) {
        setError(json.error ?? "Could not open support")
        return
      }
      await load(true)
      select(json.conversation_id)
    } catch {
      setError("Could not open support")
    } finally {
      setOpening(false)
    }
  }

  const active = items.find((i) => i.id === activeId) ?? null

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Inbox</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">Messages</h1>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={openSupport} disabled={opening}>
          {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <LifeBuoy className="h-4 w-4" />}
          Contact Hayesh Support
        </Button>
      </div>

      {error && (
        <p role="alert" className="mb-3 flex items-center gap-2 rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-3 text-sm text-text-primary">
          <AlertTriangle className="h-4 w-4 shrink-0 text-accent-danger" />
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-border bg-surface">
          <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-surface p-6 text-center">
          <MessageSquare className="h-6 w-6 text-text-muted" />
          <p className="text-sm font-medium text-text-primary">No conversations yet</p>
          <p className="max-w-sm text-sm text-text-muted">
            You can message a seller or buyer from your orders, a teacher or parent from a tuition, or reach Hayesh Support.
          </p>
        </div>
      ) : (
        <div className="grid h-[70vh] min-h-[420px] overflow-hidden rounded-lg border border-border bg-surface md:grid-cols-[320px_1fr]">
          <div className={cn("min-h-0 border-border md:border-r", active ? "hidden md:block" : "block")}>
            <ConversationList items={items} activeId={activeId} onSelect={select} />
          </div>
          <div className={cn("min-h-0", active ? "block" : "hidden md:block")}>
            {active && userId ? (
              <MessageThread
                key={active.id}
                conversation={active}
                userId={userId}
                onBack={() => select(null)}
                onActivity={() => void load(true)}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-sm text-text-muted">
                Select a conversation
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
