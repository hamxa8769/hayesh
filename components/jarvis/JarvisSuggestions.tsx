"use client"

import { motion } from "framer-motion"
import { Sparkles } from "lucide-react"
import type { JarvisSuggestion } from "@/components/jarvis/jarvis-types"

interface JarvisSuggestionsProps {
  suggestions: JarvisSuggestion[]
  onSelect: (query: string) => void
  disabled: boolean
  reducedMotion: boolean
}

export function JarvisSuggestions({ suggestions, onSelect, disabled, reducedMotion }: JarvisSuggestionsProps) {
  return (
    <div className="flex flex-col items-center gap-4 px-2 py-8 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface">
        <Sparkles className="h-5 w-5 text-accent-primary" aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary">How can I help?</p>
        <p className="mt-1 text-xs text-text-muted">Ask anything, or try one of these</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((s, i) => (
          <motion.button
            key={s.label}
            type="button"
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reducedMotion ? 0 : i * 0.05, duration: reducedMotion ? 0 : 0.3 }}
            onClick={() => onSelect(s.query)}
            disabled={disabled}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-text-muted transition-colors duration-150 hover:border-accent-primary/50 hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"
          >
            {s.label}
          </motion.button>
        ))}
      </div>
    </div>
  )
}
