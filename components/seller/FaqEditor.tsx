"use client"

import { Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { GigFaqEntry } from "@/types/database"

export interface FaqEditorProps {
  items: GigFaqEntry[]
  onChange: (items: GigFaqEntry[]) => void
  error?: string
}

export function FaqEditor({ items, onChange, error }: FaqEditorProps) {
  const addItem = () => onChange([...items, { question: "", answer: "" }])

  const updateItem = (index: number, patch: Partial<GigFaqEntry>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))

  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index))

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className="space-y-2 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">FAQ {index + 1}</span>
            <button
              type="button"
              onClick={() => removeItem(index)}
              aria-label={`Remove FAQ ${index + 1}`}
              className="text-text-muted transition-colors duration-150 hover:text-accent-danger"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <Input
            value={item.question}
            onChange={(e) => updateItem(index, { question: e.target.value })}
            placeholder="Question"
          />
          <textarea
            value={item.answer}
            onChange={(e) => updateItem(index, { answer: e.target.value })}
            placeholder="Answer"
            rows={2}
            className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
          />
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={addItem}>
        <Plus className="h-3.5 w-3.5" /> Add FAQ
      </Button>

      {error && <p className="text-xs text-accent-danger">{error}</p>}
    </div>
  )
}
