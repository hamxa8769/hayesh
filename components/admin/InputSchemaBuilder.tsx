"use client"

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils/cn"
import type { AIServiceInputField } from "@/types/database"

export interface InputSchemaBuilderProps {
  value: AIServiceInputField[]
  onChange: (fields: AIServiceInputField[]) => void
}

const FIELD_TYPE_OPTIONS: { value: AIServiceInputField["type"]; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "select", label: "Dropdown (select)" },
  { value: "file", label: "File upload" },
]

const selectClassName =
  "flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary disabled:cursor-not-allowed disabled:opacity-50"

function blankField(): AIServiceInputField {
  return { field_name: "", label: "", type: "text", required: true }
}

/**
 * Dynamic editor for ai_services.input_schema — the JSONB array that drives
 * the buyer-facing order form (see AIOrderForm on the public side). Each
 * row is one field the buyer fills in; field_name is the JSON key the
 * fulfillment route reads back out of ai_orders.user_inputs.
 */
export function InputSchemaBuilder({ value, onChange }: InputSchemaBuilderProps) {
  const fields = value ?? []

  const updateField = (index: number, patch: Partial<AIServiceInputField>) => {
    const next = fields.map((f, i) => (i === index ? { ...f, ...patch } : f))
    onChange(next)
  }

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index))
  }

  const addField = () => {
    onChange([...fields, blankField()])
  }

  const moveField = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= fields.length) return
    const next = [...fields]
    const tmp = next[index]
    next[index] = next[target]
    next[target] = tmp
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Order form fields</Label>
        <span className="font-mono text-xs text-text-muted">{fields.length} field{fields.length === 1 ? "" : "s"}</span>
      </div>
      <p className="text-xs text-text-muted">
        These fields become the buyer&apos;s order form. field_name is the key stored on the order and read back when
        the AI runs.
      </p>

      {fields.length === 0 && (
        <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
          No input fields yet. Buyers will see a blank order with no way to tell the AI what they need — add at
          least one field.
        </p>
      )}

      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={index} className="rounded-lg border border-border bg-surface p-3 sm:p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={`field_name_${index}`} className="text-xs">
                  Field name (key)
                </Label>
                <Input
                  id={`field_name_${index}`}
                  value={field.field_name}
                  onChange={(e) => updateField(index, { field_name: e.target.value })}
                  placeholder="e.g. topic"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`field_label_${index}`} className="text-xs">
                  Label shown to buyer
                </Label>
                <Input
                  id={`field_label_${index}`}
                  value={field.label}
                  onChange={(e) => updateField(index, { label: e.target.value })}
                  placeholder="e.g. What's your topic?"
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1">
                <Label htmlFor={`field_type_${index}`} className="text-xs">
                  Field type
                </Label>
                <select
                  id={`field_type_${index}`}
                  value={field.type}
                  onChange={(e) => updateField(index, { type: e.target.value as AIServiceInputField["type"] })}
                  className={selectClassName}
                >
                  {FIELD_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 self-end pb-2 text-sm text-text-primary sm:pb-0 sm:self-center">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => updateField(index, { required: e.target.checked })}
                  className="h-4 w-4 rounded border-border bg-surface-elevated accent-accent-primary"
                />
                Required
              </label>
            </div>

            {field.type === "select" && (
              <div className="mt-3 space-y-1">
                <Label htmlFor={`field_options_${index}`} className="text-xs">
                  Options (comma-separated)
                </Label>
                <Input
                  id={`field_options_${index}`}
                  value={(field.options ?? []).join(", ")}
                  onChange={(e) =>
                    updateField(index, {
                      options: e.target.value
                        .split(",")
                        .map((o) => o.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="e.g. Basic, Standard, Premium"
                />
              </div>
            )}

            <div className="mt-3 flex items-center justify-end gap-1 border-t border-border pt-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={index === 0}
                onClick={() => moveField(index, -1)}
                aria-label="Move field up"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={index === fields.length - 1}
                onClick={() => moveField(index, 1)}
                aria-label="Move field down"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8 text-accent-danger hover:text-accent-danger")}
                onClick={() => removeField(index)}
                aria-label="Remove field"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="secondary" size="sm" onClick={addField} className="gap-1.5">
        <Plus className="h-4 w-4" />
        Add field
      </Button>
    </div>
  )
}
