"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"
import { Cpu, ArrowLeft, Zap, Clock } from "lucide-react"
import { JarvisCard } from "@/components/ui/jarvis-card"
import { JarvisButton } from "@/components/ui/jarvis-button"
import { JarvisInput } from "@/components/ui/jarvis-input"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { formatPKR } from "@/lib/utils/format"
import Link from "next/link"
import type { AIService } from "@/types/database"

export default function AIServiceDetailPage() {
  const params = useParams()
  const [service, setService] = useState<AIService | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const fetchService = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("ai_services").select("*").eq("id", params.id).single()
      setService(data as AIService | null)
      setLoading(false)
    }
    if (params.id) fetchService()
  }, [params.id])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div key={i} className="h-2 w-2 rounded-full bg-accent-success" animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
          ))}
        </div>
      </div>
    )
  }

  if (!service) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-text-muted">Service not found</p>
        <Link href="/ai-services"><JarvisButton variant="secondary"><ArrowLeft className="h-4 w-4 mr-1" /> Back to AI Services</JarvisButton></Link>
      </div>
    )
  }

  const inputFields = (service.input_schema || []) as Array<{ field_name: string; type: string; label: string; required?: boolean }>

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link href="/ai-services" className="mb-6 inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to AI Services
        </Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <JarvisCard glow="green" className="p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-success/20">
                <Cpu className="h-8 w-8 text-accent-success" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="font-display text-2xl font-bold text-text-primary">{service.title}</h1>
                  <Badge variant="success">HayeshAI</Badge>
                </div>
                {service.description && <p className="mt-2 text-text-muted">{service.description}</p>}
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-text-muted">
                  <span className="flex items-center gap-1"><Zap className="h-4 w-4 text-accent-success" /> AI Powered</span>
                  <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> ~{service.delivery_time_hrs || 1}hr delivery</span>
                  {service.category && <Badge variant="default">{service.category}</Badge>}
                </div>
              </div>
            </div>
          </JarvisCard>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <JarvisCard glow="none" className="p-6">
                <h2 className="mb-4 font-display text-lg font-bold text-text-primary">Describe Your Request</h2>
                <div className="space-y-4">
                  {inputFields.length > 0 ? (
                    inputFields.map((field) => (
                      <JarvisInput
                        key={field.field_name}
                        label={field.label + (field.required ? " *" : "")}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                      />
                    ))
                  ) : (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-text-primary">Your Prompt *</label>
                      <textarea
                        className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/50"
                        rows={5}
                        placeholder="Describe what you need..."
                      />
                    </div>
                  )}
                </div>
              </JarvisCard>
            </div>

            <div>
              <JarvisCard glow="violet" className="p-6">
                <h2 className="mb-4 font-display text-lg font-bold text-text-primary">Order Summary</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-muted">Service</span>
                    <span className="text-sm text-text-primary">{service.title}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-muted">Delivery</span>
                    <span className="text-sm text-text-primary">~{service.delivery_time_hrs || 1}hr</span>
                  </div>
                </div>
                <div className="mt-4 border-t border-border pt-4">
                  <p className="font-mono text-2xl font-bold text-accent-success">{formatPKR(service.price_pkr || 0)}</p>
                  <JarvisButton variant="primary" className="w-full mt-3" loading={submitting}>
                    <Zap className="h-4 w-4 mr-1" /> Order Now
                  </JarvisButton>
                </div>
              </JarvisCard>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
