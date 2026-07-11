"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Bot, RotateCcw, Star, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Reveal } from "@/components/motion/Reveal"
import { createClient } from "@/lib/supabase/client"
import { formatPKR } from "@/lib/utils/format"
import type { AIService, AIServiceInputField } from "@/types/database"

type FormValues = Record<string, string>

export default function AIServiceDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [service, setService] = useState<AIService | null>(null)
  const [loading, setLoading] = useState(true)
  const [formValues, setFormValues] = useState<FormValues>({})

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("ai_services").select("*").eq("id", id).single()
      setService(data as AIService | null)
      setLoading(false)
    }
    load()
  }, [id])

  const handleFieldChange = (fieldName: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [fieldName]: value }))
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="font-mono text-sm uppercase tracking-[0.12em] text-text-muted">Loading...</p>
      </div>
    )
  }

  if (!service) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-text-muted">Service not found</p>
      </div>
    )
  }

  const inputFields: AIServiceInputField[] = service.input_schema || []

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:px-10">
        <button
          onClick={() => router.back()}
          className="mb-8 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.1em] text-text-muted transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        <Reveal>
          <div className="relative overflow-hidden rounded-lg border border-border bg-surface p-8">
            <div className="absolute inset-x-0 top-0 h-[2px] aurora-bg" />

            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-accent-primary/30 bg-accent-primary/10 text-accent-primary">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <Badge variant="aurora">HayeshAI Studio</Badge>
                <h1 className="mt-2 text-balance font-display text-2xl font-bold tracking-tight sm:text-3xl">{service.title}</h1>
              </div>
            </div>

            <p className="mt-5 leading-relaxed text-text-muted">{service.description}</p>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs tabular-nums text-text-muted">
              {service.delivery_time_hrs != null && (
                <span className="inline-flex items-center gap-1.5 uppercase tracking-[0.08em] text-accent-secondary">
                  <Zap className="h-3.5 w-3.5" />
                  {service.delivery_time_hrs <= 1 ? "Instant delivery" : `${service.delivery_time_hrs}h delivery`}
                </span>
              )}
              {service.average_rating != null && (
                <span className="inline-flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 fill-accent-secondary text-accent-secondary" />
                  {service.average_rating.toFixed(1)}
                  {service.total_reviews != null && <span className="text-text-disabled">({service.total_reviews} reviews)</span>}
                </span>
              )}
              {service.revisions_allowed != null && (
                <span className="inline-flex items-center gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" />
                  {service.revisions_allowed} revisions
                </span>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between rounded border border-accent-primary/25 bg-accent-primary/5 px-5 py-4">
              <span className="font-mono text-xs uppercase tracking-[0.1em] text-text-muted">Price</span>
              <span className="font-mono text-2xl font-bold tabular-nums text-accent-primary">{formatPKR(service.price_pkr || 0)}</span>
            </div>
          </div>
        </Reveal>

        {inputFields.length > 0 && (
          <Reveal delay={0.1} className="mt-8">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Order details</span>
            <div className="mt-4 space-y-5 rounded-lg border border-border bg-surface p-6">
              {inputFields.map((field) => (
                <div key={field.field_name} className="space-y-1.5">
                  <label className="text-sm font-medium text-text-muted">
                    {field.label}
                    {field.required && <span className="ml-1 text-accent-secondary">*</span>}
                  </label>

                  {field.type === "textarea" && (
                    <textarea
                      value={formValues[field.field_name] || ""}
                      onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
                      rows={4}
                      className="w-full resize-none rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:border-accent-primary/60 focus:outline-none"
                    />
                  )}

                  {field.type === "select" && (
                    <select
                      value={formValues[field.field_name] || ""}
                      onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-text-primary focus:border-accent-primary/60 focus:outline-none"
                    >
                      <option value="" disabled>Select an option</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}

                  {field.type === "file" && (
                    <input
                      type="file"
                      onChange={(e) => handleFieldChange(field.field_name, e.target.files?.[0]?.name || "")}
                      className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-text-muted file:mr-3 file:rounded file:border-0 file:bg-accent-primary/10 file:px-3 file:py-1.5 file:font-mono file:text-xs file:uppercase file:tracking-[0.06em] file:text-accent-primary focus:border-accent-primary/60 focus:outline-none"
                    />
                  )}

                  {field.type === "text" && (
                    <input
                      type="text"
                      value={formValues[field.field_name] || ""}
                      onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:border-accent-primary/60 focus:outline-none"
                    />
                  )}
                </div>
              ))}
            </div>
          </Reveal>
        )}

        <Reveal delay={0.15} className="mt-8">
          <Button variant="aurora" size="lg" className="w-full">Order Now</Button>
        </Reveal>
      </div>
    </div>
  )
}
