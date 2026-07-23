"use client"

import { useEffect, useRef, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Loader2, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InputSchemaBuilder } from "@/components/admin/InputSchemaBuilder"
import { cn } from "@/lib/utils/cn"
import type { AIOutputFormat, AIService, AIServiceInputField, AIServiceStatus } from "@/types/database"

/**
 * Client-safe mirror of AI_SERVICE_MODELS from lib/ai/claude.ts. That module
 * guards itself against client-side import (it reads ANTHROPIC_API_KEY), so
 * this dropdown carries its own copy of the same real, current model ids
 * rather than importing the server-only module.
 */
const MODEL_OPTIONS = [
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 — recommended (balanced cost & quality)" },
  { value: "claude-haiku-4-5", label: "Claude Haiku 4.5 — fastest & cheapest" },
  { value: "claude-opus-4-8", label: "Claude Opus 4.8 — most capable, highest cost" },
] as const

const OUTPUT_FORMAT_OPTIONS: { value: AIOutputFormat; label: string }[] = [
  { value: "text", label: "Plain text" },
  { value: "code", label: "Code" },
  { value: "document", label: "Document" },
  { value: "json", label: "JSON" },
]

const STATUS_OPTIONS: { value: AIServiceStatus; label: string }[] = [
  { value: "draft", label: "Draft (hidden from buyers)" },
  { value: "active", label: "Active (visible & orderable)" },
  { value: "paused", label: "Paused (visible, not orderable)" },
]

const inputFieldSchema = z
  .object({
    field_name: z
      .string()
      .trim()
      .min(1, "Field name is required")
      .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Use letters, numbers, underscores only"),
    label: z.string().trim().min(1, "Label is required"),
    type: z.enum(["text", "textarea", "file", "select"]),
    required: z.boolean(),
    options: z.array(z.string()).optional(),
  })
  .refine((f) => f.type !== "select" || (f.options && f.options.length > 0), {
    message: "Select fields need at least one option",
    path: ["options"],
  })

const formSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().min(1, "Description is required").max(3000),
  category: z.string().trim().min(1, "Category is required").max(100),
  thumbnail_url: z.union([z.literal(""), z.string().trim().url("Must be a valid URL")]),
  status: z.enum(["active", "paused", "draft"]),
  price_pkr: z.coerce.number().min(0, "Cannot be negative"),
  price_usd: z.coerce.number().min(0, "Cannot be negative"),
  ai_model: z.string().trim().min(1, "Model is required"),
  system_prompt: z.string().trim().min(1, "System prompt is required"),
  output_format: z.enum(["text", "code", "document", "json"]),
  delivery_time_hrs: z.coerce.number().int().min(0, "Cannot be negative"),
  revisions_allowed: z.coerce.number().int().min(0, "Cannot be negative"),
  input_schema: z.array(inputFieldSchema),
})

type FormValues = z.infer<typeof formSchema>

const emptyValues: FormValues = {
  title: "",
  description: "",
  category: "",
  thumbnail_url: "",
  status: "draft",
  price_pkr: 0,
  price_usd: 0,
  ai_model: "claude-sonnet-4-6",
  system_prompt: "",
  output_format: "text",
  delivery_time_hrs: 0,
  revisions_allowed: 1,
  input_schema: [],
}

function serviceToFormValues(service: AIService): FormValues {
  return {
    title: service.title,
    description: service.description,
    category: service.category,
    thumbnail_url: service.thumbnail_url ?? "",
    status: service.status ?? "draft",
    price_pkr: service.price_pkr ?? 0,
    price_usd: service.price_usd ?? 0,
    ai_model: service.ai_model ?? "claude-sonnet-4-6",
    system_prompt: service.system_prompt,
    output_format: service.output_format ?? "text",
    delivery_time_hrs: service.delivery_time_hrs ?? 0,
    revisions_allowed: service.revisions_allowed ?? 1,
    input_schema: service.input_schema ?? [],
  }
}

const selectClassName =
  "flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary disabled:cursor-not-allowed disabled:opacity-50"

const textareaClassName =
  "flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary disabled:cursor-not-allowed disabled:opacity-50"

export interface AIServiceFormModalProps {
  open: boolean
  service: AIService | null
  onClose: () => void
  onSaved: () => void
}

export function AIServiceFormModal({ open, service, onClose, onSaved }: AIServiceFormModalProps) {
  const prefersReducedMotion = useReducedMotion()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const submittingRef = useRef(submitting)
  const isEdit = Boolean(service)

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
    // z.coerce.number() makes the schema's INPUT type `unknown` while its output
    // (FormValues) is `number`. The three-generic useForm<Input, Context, Output>
    // form is RHF's supported way to reconcile that — a plain useForm<FormValues>
    // mismatches the resolver and fails the build.
  } = useForm<z.input<typeof formSchema>, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyValues,
    mode: "onBlur",
  })

  useEffect(() => {
    submittingRef.current = submitting
  }, [submitting])

  useEffect(() => {
    if (!open) return
    setSubmitError(null)
    reset(service ? serviceToFormValues(service) : emptyValues)
  }, [open, service, reset])

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("#ai-service-title")?.focus()
    })
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submittingRef.current) onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("keydown", onKeyDown)
      previouslyFocused?.focus()
    }
  }, [open, onClose])

  const close = () => {
    if (submitting) return
    setSubmitError(null)
    onClose()
  }

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const payload = {
        ...values,
        thumbnail_url: values.thumbnail_url || null,
      }

      const res = await fetch("/api/admin/ai-services", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { id: service!.id, ...payload } : payload),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to save service")
      }
      onSaved()
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-3 py-6 sm:items-center sm:p-4">
          <motion.button
            aria-hidden="true"
            tabIndex={-1}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-service-modal-title"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="glass relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent-primary" />
                <h2 id="ai-service-modal-title" className="font-display text-lg font-semibold text-text-primary">
                  {isEdit ? "Edit AI Service" : "New AI Service"}
                </h2>
              </div>
              <button
                onClick={close}
                aria-label="Close"
                className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-5 sm:p-6">
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="ai-service-title">Title</Label>
                    <Input id="ai-service-title" {...register("title")} placeholder="e.g. Code & Feature Development" />
                    {errors.title && <p className="text-xs text-accent-danger">{errors.title.message}</p>}
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="ai-service-description">Description (shown to buyers)</Label>
                    <textarea
                      id="ai-service-description"
                      rows={3}
                      className={textareaClassName}
                      placeholder="What does this service do for the buyer?"
                      {...register("description")}
                    />
                    {errors.description && <p className="text-xs text-accent-danger">{errors.description.message}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ai-service-category">Category</Label>
                    <Input id="ai-service-category" {...register("category")} placeholder="e.g. Development" />
                    {errors.category && <p className="text-xs text-accent-danger">{errors.category.message}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ai-service-thumbnail">Thumbnail URL (optional)</Label>
                    <Input id="ai-service-thumbnail" {...register("thumbnail_url")} placeholder="https://…" />
                    {errors.thumbnail_url && <p className="text-xs text-accent-danger">{errors.thumbnail_url.message}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ai-service-status">Status</Label>
                    <select id="ai-service-status" className={selectClassName} {...register("status")}>
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ai-service-output-format">Output format</Label>
                    <select id="ai-service-output-format" className={selectClassName} {...register("output_format")}>
                      {OUTPUT_FORMAT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ai-service-price-pkr">Price (PKR)</Label>
                    <Input id="ai-service-price-pkr" type="number" min={0} step="1" {...register("price_pkr")} />
                    {errors.price_pkr && <p className="text-xs text-accent-danger">{errors.price_pkr.message}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ai-service-price-usd">Price (USD)</Label>
                    <Input id="ai-service-price-usd" type="number" min={0} step="0.01" {...register("price_usd")} />
                    {errors.price_usd && <p className="text-xs text-accent-danger">{errors.price_usd.message}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ai-service-delivery">Delivery time (hours, 0 = instant)</Label>
                    <Input
                      id="ai-service-delivery"
                      type="number"
                      min={0}
                      step="1"
                      {...register("delivery_time_hrs")}
                    />
                    {errors.delivery_time_hrs && (
                      <p className="text-xs text-accent-danger">{errors.delivery_time_hrs.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ai-service-revisions">Revisions allowed</Label>
                    <Input
                      id="ai-service-revisions"
                      type="number"
                      min={0}
                      step="1"
                      {...register("revisions_allowed")}
                    />
                    {errors.revisions_allowed && (
                      <p className="text-xs text-accent-danger">{errors.revisions_allowed.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ai-service-model">AI model</Label>
                    <select id="ai-service-model" className={selectClassName} {...register("ai_model")}>
                      {MODEL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="ai-service-system-prompt">System prompt</Label>
                    <span className="rounded-full border border-accent-warning/30 bg-accent-warning/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-accent-warning">
                      Internal — never shown to buyers
                    </span>
                  </div>
                  <textarea
                    id="ai-service-system-prompt"
                    rows={10}
                    className={cn(textareaClassName, "font-mono text-xs leading-relaxed")}
                    placeholder="Role, constraints, and required output structure for the agent…"
                    {...register("system_prompt")}
                  />
                  {errors.system_prompt && <p className="text-xs text-accent-danger">{errors.system_prompt.message}</p>}
                </div>

                <div className="rounded-lg border border-line-strong bg-surface p-4">
                  <Controller
                    control={control}
                    name="input_schema"
                    render={({ field }) => (
                      <InputSchemaBuilder
                        value={field.value as AIServiceInputField[]}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>
              </div>

              {submitError && <p className="mt-4 text-sm text-accent-danger">{submitError}</p>}

              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={close} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="aurora" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isEdit ? "Save changes" : "Create service"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
