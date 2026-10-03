"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, MessageSquare } from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/button"

interface MessageSellerButtonProps {
  gigId: string
  /** Where to send signed-out visitors back to after login. */
  redirectPath: string
  label?: string
  variant?: ButtonProps["variant"]
  size?: ButtonProps["size"]
  className?: string
}

interface ConversationResponse {
  conversation_id?: string
  error?: string
}

/** Opens (or resumes) a pre-order inquiry with the seller, then jumps to the inbox. */
export function MessageSellerButton({
  gigId,
  redirectPath,
  label = "Message seller",
  variant = "outline",
  size = "default",
  className,
}: MessageSellerButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gig_id: gigId }),
      })
      if (res.status === 401) {
        router.push(`/auth/login?redirect=${encodeURIComponent(redirectPath)}`)
        return
      }
      const json = (await res.json().catch(() => ({}))) as ConversationResponse
      if (!res.ok || !json.conversation_id) {
        setError(json.error ?? "Could not start the conversation. Please try again.")
        setLoading(false)
        return
      }
      router.push(`/messages?c=${json.conversation_id}`)
    } catch {
      setError("Network error. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className={className}>
      <Button type="button" variant={variant} size={size} className="w-full" onClick={start} disabled={loading} aria-busy={loading}>
        {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <MessageSquare aria-hidden="true" />}
        {loading ? "Opening chat…" : label}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-accent-danger">
          {error}
        </p>
      )}
    </div>
  )
}
