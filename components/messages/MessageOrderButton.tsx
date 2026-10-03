"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface MessageOrderButtonProps {
  orderId: string
  label: string
}

/** Opens (or creates) the order conversation, then jumps to /messages. */
export function MessageOrderButton({ orderId, label }: MessageOrderButtonProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gig_order_id: orderId }),
      })
      const json = (await res.json()) as { conversation_id?: string; error?: string }
      if (!res.ok || !json.conversation_id) {
        setError(json.error ?? "Could not open conversation")
        setBusy(false)
        return
      }
      router.push(`/messages?c=${json.conversation_id}`)
    } catch {
      setError("Could not open conversation")
      setBusy(false)
    }
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={open} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
        {label}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-accent-danger">
          {error}
        </span>
      )}
    </>
  )
}
