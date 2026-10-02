"use client"

import { useCallback, useRef, useState } from "react"
import type { JarvisMessage } from "@/components/jarvis/jarvis-types"

interface JarvisApiResponse {
  answer?: string
  error?: string
}

interface UseJarvisChatReturn {
  messages: JarvisMessage[]
  isPending: boolean
  canRetry: boolean
  send: (query: string) => Promise<void>
  retry: () => void
}

interface HistoryTurn {
  role: "user" | "assistant"
  content: string
}

const HISTORY_TURNS = 8
const HISTORY_CHARS = 2000

function toHistory(messages: JarvisMessage[]): HistoryTurn[] {
  return messages
    .filter((m) => !m.isError)
    .slice(-HISTORY_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, HISTORY_CHARS) }))
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

const NETWORK_ERROR = "I couldn't reach JARVIS just now. Check your connection and try again."
const AUTH_ERROR = "Your session may have expired. Refresh the page and sign in again."

/**
 * Talks to the existing /api/jarvis backend.
 * Contract (see app/api/jarvis/route.ts — not modified here):
 *   POST /api/jarvis  body: { query: string, history?: {role, content}[] (last ~8 turns) }
 *   200 -> { answer: string, complexity?: "simple" | "medium" | "complex" }
 *          (on internal failure the route still returns 200 with a fallback `answer`)
 *   400 -> { error: "No query" }
 *   401 -> { error: "Unauthorized" }
 * Auth is cookie-based (Supabase server client reads the session from the
 * request cookies), so no extra headers are required beyond same-origin fetch.
 */
export function useJarvisChat(): UseJarvisChatReturn {
  const [messages, setMessages] = useState<JarvisMessage[]>([])
  const [isPending, setIsPending] = useState(false)
  const lastQueryRef = useRef<string | null>(null)

  const askJarvis = useCallback(async (query: string, history: HistoryTurn[]) => {
    setIsPending(true)
    try {
      const res = await fetch("/api/jarvis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, history }),
      })

      const data: JarvisApiResponse = await res.json().catch(() => ({}))

      if (!res.ok) {
        const errorText = res.status === 401 ? AUTH_ERROR : data.error || NETWORK_ERROR
        setMessages((prev) => [...prev, { id: createId(), role: "assistant", content: errorText, isError: true }])
        return
      }

      setMessages((prev) => [
        ...prev,
        { id: createId(), role: "assistant", content: data.answer || NETWORK_ERROR },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: createId(), role: "assistant", content: NETWORK_ERROR, isError: true },
      ])
    } finally {
      setIsPending(false)
    }
  }, [])

  const send = useCallback(
    async (query: string) => {
      const trimmed = query.trim()
      if (!trimmed || isPending) return
      lastQueryRef.current = trimmed
      const history = toHistory(messages)
      setMessages((prev) => [...prev, { id: createId(), role: "user", content: trimmed }])
      await askJarvis(trimmed, history)
    },
    [isPending, askJarvis, messages]
  )

  const retry = useCallback(() => {
    const last = lastQueryRef.current
    if (!last || isPending) return
    // History excludes error bubbles and the failed user turn being retried.
    const base = messages.filter((m) => !m.isError)
    const history = toHistory(base.length > 0 && base[base.length - 1].role === "user" ? base.slice(0, -1) : base)
    setMessages((prev) => (prev.length > 0 && prev[prev.length - 1].isError ? prev.slice(0, -1) : prev))
    void askJarvis(last, history)
  }, [isPending, askJarvis, messages])

  const canRetry = messages.length > 0 && messages[messages.length - 1]?.isError === true

  return { messages, isPending, canRetry, send, retry }
}
