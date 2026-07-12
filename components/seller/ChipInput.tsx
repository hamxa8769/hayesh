"use client"

import { useState } from "react"
import type { KeyboardEvent } from "react"
import { Plus, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils/cn"

export interface ChipInputProps {
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  maxItems?: number
  error?: string
  className?: string
}

export function ChipInput({ values, onChange, placeholder, maxItems, error, className }: ChipInputProps) {
  const [draft, setDraft] = useState("")

  const addValue = () => {
    const trimmed = draft.trim()
    if (!trimmed) return
    if (values.includes(trimmed)) {
      setDraft("")
      return
    }
    if (maxItems && values.length >= maxItems) return
    onChange([...values, trimmed])
    setDraft("")
  }

  const removeValue = (index: number) => {
    onChange(values.filter((_, i) => i !== index))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault()
      addValue()
    } else if (event.key === "Backspace" && draft === "" && values.length > 0) {
      removeValue(values.length - 1)
    }
  }

  const atLimit = Boolean(maxItems && values.length >= maxItems)

  return (
    <div className={className}>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={atLimit ? "Limit reached" : placeholder}
          disabled={atLimit}
        />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={addValue}
          disabled={atLimit || draft.trim().length === 0}
          aria-label="Add"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {values.map((value, index) => (
            <span
              key={`${value}-${index}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-text-primary"
            >
              {value}
              <button
                type="button"
                onClick={() => removeValue(index)}
                aria-label={`Remove ${value}`}
                className="text-text-muted transition-colors duration-150 hover:text-accent-danger"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {error && <p className={cn("mt-1.5 text-xs text-accent-danger")}>{error}</p>}
    </div>
  )
}
