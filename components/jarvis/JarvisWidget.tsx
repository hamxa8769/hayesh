"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MessageCircle, X, Send, Loader2 } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { useSupabase } from "@/hooks/useSupabase"

interface Message { role: "user" | "jarvis"; content: string }

export function JarvisWidget() {
  const { profile } = useSupabase()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput("")
    setMessages((m) => [...m, { role: "user", content: userMsg }])
    setLoading(true)

    try {
      const res = await fetch("/api/jarvis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMsg }),
      })
      const data = await res.json()
      setMessages((m) => [...m, { role: "jarvis", content: data.answer || "Error" }])
    } catch {
      setMessages((m) => [...m, { role: "jarvis", content: "Connection error." }])
    }
    setLoading(false)
  }

  return (
    <>
      <motion.button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent-primary shadow-lg hover:shadow-accent-primary/40 transition-shadow"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="h-6 w-6 text-white" />
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <MessageCircle className="h-6 w-6 text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-24 right-6 z-50 w-96 max-h-[500px] flex flex-col"
          >
            <JarvisCard glow="cyan" className="flex flex-col h-full overflow-hidden">
              <div className="border-b border-border p-4">
                <h3 className="font-display font-bold text-text-primary">JARVIS</h3>
                <p className="text-xs text-text-muted">AI Assistant {profile ? `• ${profile.role}` : ""}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0" style={{ maxHeight: "350px" }}>
                {messages.length === 0 && (
                  <p className="text-center text-sm text-text-muted py-8">How can I help you today?</p>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-accent-primary text-white" : "bg-surface-elevated text-text-primary"}`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-lg bg-surface-elevated px-3 py-2"><Loader2 className="h-4 w-4 animate-spin text-accent-primary" /></div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              <div className="border-t border-border p-3">
                <div className="flex gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder="Ask JARVIS..."
                    className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none"
                  />
                  <button onClick={send} disabled={loading || !input.trim()} className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-primary text-white hover:bg-accent-primary/80 disabled:opacity-50">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </JarvisCard>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
