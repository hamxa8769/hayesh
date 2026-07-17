"use client"

import { motion } from "framer-motion"
import { AlertCircle, Bot } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import type { JarvisMessage } from "@/components/jarvis/jarvis-types"

interface JarvisMessageBubbleProps {
  message: JarvisMessage
  reducedMotion: boolean
}

export function JarvisMessageBubble({ message, reducedMotion }: JarvisMessageBubbleProps) {
  const isUser = message.role === "user"

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex items-start gap-2", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
            message.isError ? "border-accent-danger/40 bg-accent-danger/10" : "border-border bg-surface"
          )}
        >
          {message.isError ? (
            <AlertCircle className="h-3.5 w-3.5 text-accent-danger" aria-hidden="true" />
          ) : (
            <Bot className="h-3.5 w-3.5 text-accent-primary" aria-hidden="true" />
          )}
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed",
          isUser
            ? "bg-accent-primary text-white"
            : message.isError
              ? "border border-accent-danger/30 bg-accent-danger/10 text-text-primary"
              : "border border-border bg-surface text-text-primary"
        )}
      >
        {message.content}
      </div>
    </motion.div>
  )
}
