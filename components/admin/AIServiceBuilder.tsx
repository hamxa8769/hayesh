"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Bot, Check, Loader2, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AIServiceFormModal } from "@/components/admin/AIServiceFormModal"
import { cn } from "@/lib/utils/cn"
import type { AIService, AIServiceStatus } from "@/types/database"

const STATUS_BADGE: Record<AIServiceStatus, "success" | "warning" | "secondary"> = {
  active: "success",
  paused: "warning",
  draft: "secondary",
}

interface FetchState {
  services: AIService[]
  loading: boolean
  error: string | null
}

function formatPrice(pkr: number | null, usd: number | null): string {
  const parts: string[] = []
  if (pkr !== null) parts.push(`₨${pkr.toLocaleString()}`)
  if (usd !== null) parts.push(`$${usd.toLocaleString()}`)
  return parts.length > 0 ? parts.join(" / ") : "—"
}

/**
 * Admin-only builder for public.ai_services ("HayeshAI Studio"). Lists every
 * service (active/paused/draft), seeds the curated default catalog, and
 * opens AIServiceFormModal for create/edit. All reads/writes — including
 * system_prompt — go through /api/admin/ai-services, which is the only
 * route allowed to touch that column (service-role client, admin-gated).
 */
export function AIServiceBuilder() {
  const [state, setState] = useState<FetchState>({ services: [], loading: true, error: null })
  const [modalOpen, setModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<AIService | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [seedMessage, setSeedMessage] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch("/api/admin/ai-services")
      const json = (await res.json()) as { services?: AIService[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? "Failed to load services")
      setState({ services: json.services ?? [], loading: false, error: null })
    } catch (e: unknown) {
      setState({ services: [], loading: false, error: e instanceof Error ? e.message : "Failed to load services" })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditingService(null)
    setModalOpen(true)
  }

  const openEdit = (service: AIService) => {
    setEditingService(service)
    setModalOpen(true)
  }

  const handleSaved = () => {
    setModalOpen(false)
    setEditingService(null)
    load()
  }

  const handleSeed = async () => {
    setSeeding(true)
    setSeedMessage(null)
    try {
      const res = await fetch("/api/admin/ai-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      })
      const json = (await res.json()) as { seeded?: number; skipped?: number; error?: string }
      if (!res.ok) throw new Error(json.error ?? "Failed to seed default services")
      const seeded = json.seeded ?? 0
      setSeedMessage(
        seeded > 0
          ? `Added ${seeded} default service${seeded === 1 ? "" : "s"}${json.skipped ? ` (${json.skipped} already existed)` : ""}.`
          : "All default services already exist — nothing new to add."
      )
      load()
    } catch (e: unknown) {
      setSeedMessage(e instanceof Error ? e.message : "Failed to seed default services")
    } finally {
      setSeeding(false)
    }
  }

  const confirmDelete = async (id: string) => {
    setDeletingId(id)
    setRowError(null)
    try {
      const res = await fetch(`/api/admin/ai-services?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Failed to delete service")
      setPendingDeleteId(null)
      load()
    } catch (e: unknown) {
      setRowError(e instanceof Error ? e.message : "Failed to delete service")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Admin / AI Services</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-text-primary sm:text-3xl">HayeshAI Studio Builder</h1>
          <p className="mt-1 max-w-xl text-sm text-text-muted">
            Admin-configured Claude agents that fulfil orders automatically — the platform&apos;s highest-margin
            product. Configure the model, prompt, pricing, and buyer-facing order form for each service.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={handleSeed} disabled={seeding} className="gap-1.5">
            {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Seed default services
          </Button>
          <Button variant="aurora" onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Service
          </Button>
        </div>
      </div>

      {seedMessage && (
        <p className="rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm text-text-muted">{seedMessage}</p>
      )}
      {rowError && (
        <p className="flex items-center gap-2 rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-4 py-2.5 text-sm text-accent-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {rowError}
        </p>
      )}

      {state.loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-surface" />
          ))}
        </div>
      ) : state.error ? (
        <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-accent-danger" />
          <p className="mt-3 text-sm text-accent-danger">{state.error}</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={load}>
            Retry
          </Button>
        </div>
      ) : state.services.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong bg-surface p-12 text-center">
          <Bot className="mx-auto h-10 w-10 text-text-disabled" />
          <p className="mt-3 text-sm font-medium text-text-primary">No AI services yet</p>
          <p className="mt-1 text-sm text-text-muted">
            Seed the curated catalog (coding, writing, CVs, SEO, and more) or build your own from scratch.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Button variant="aurora" onClick={handleSeed} disabled={seeding} className="gap-1.5">
              {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Seed default services
            </Button>
            <Button variant="secondary" onClick={openCreate} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Create manually
            </Button>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-elevated text-left font-mono text-xs uppercase tracking-[0.08em] text-text-muted">
                  <th className="px-4 py-3 font-medium">Service</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 text-right font-medium tabular-nums">Orders</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {state.services.map((service) => (
                  <tr key={service.id} className="border-b border-border bg-surface last:border-b-0 hover:bg-surface-elevated">
                    <td className="max-w-[280px] px-4 py-3">
                      <p className="truncate font-medium text-text-primary">{service.title}</p>
                      <p className="truncate text-xs text-text-muted">{service.description}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE[service.status ?? "draft"]}>{service.status ?? "draft"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-text-muted">{service.category}</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-text-primary">
                      {formatPrice(service.price_pkr, service.price_usd)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-text-muted">
                      {service.total_orders ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {pendingDeleteId === service.id ? (
                          <>
                            <span className="mr-1 text-xs text-text-muted">Delete?</span>
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-8 w-8"
                              disabled={deletingId === service.id}
                              onClick={() => confirmDelete(service.id)}
                              aria-label="Confirm delete"
                            >
                              {deletingId === service.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={deletingId === service.id}
                              onClick={() => setPendingDeleteId(null)}
                              aria-label="Cancel delete"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(service)}
                              aria-label={`Edit ${service.title}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn("h-8 w-8 text-accent-danger hover:text-accent-danger")}
                              onClick={() => {
                                setRowError(null)
                                setPendingDeleteId(service.id)
                              }}
                              aria-label={`Delete ${service.title}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AIServiceFormModal
        open={modalOpen}
        service={editingService}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  )
}
