"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, Loader2, Lock, Send, UserCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/lib/utils/format"
import { cn } from "@/lib/utils/cn"
import type { AdminSupportTicketRow, SupportTicketPriority, SupportTicketStatus } from "@/components/admin/TicketList"

export interface TicketThreadProps {
  ticketId: string
}

interface TicketMessage {
  id: string
  ticket_id: string
  sender_id: string
  body: string
  is_internal: boolean | null
  created_at: string | null
  sender_name: string
  sender_role: string
}

interface RawMessageRow {
  id: string
  ticket_id: string
  sender_id: string
  body: string
  is_internal: boolean | null
  created_at: string | null
  profiles: { full_name: string; role: string } | null
}

const STATUS_OPTIONS: SupportTicketStatus[] = ["open", "pending", "resolved", "closed"]
const PRIORITY_OPTIONS: SupportTicketPriority[] = ["low", "normal", "high"]

const STATUS_BADGE: Record<SupportTicketStatus, "warning" | "outline" | "success" | "secondary"> = {
  open: "warning",
  pending: "outline",
  resolved: "success",
  closed: "secondary",
}

const PRIORITY_BADGE: Record<SupportTicketPriority, "secondary" | "outline" | "destructive"> = {
  low: "secondary",
  normal: "outline",
  high: "destructive",
}

export function TicketThread({ ticketId }: TicketThreadProps) {
  const [ticket, setTicket] = useState<AdminSupportTicketRow | null>(null)
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null)

  const [statusSaving, setStatusSaving] = useState(false)
  const [prioritySaving, setPrioritySaving] = useState(false)
  const [assignSaving, setAssignSaving] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)

  const [replyBody, setReplyBody] = useState("")
  const [isInternal, setIsInternal] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const optimisticIdRef = useRef(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()

      const [
        { data: authData },
        { data: ticketRow, error: ticketError },
        { data: messageRows, error: messagesError },
      ] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("support_tickets")
          .select("*, profiles(full_name, email, role)")
          .eq("id", ticketId)
          .maybeSingle(),
        supabase
          .from("support_ticket_messages")
          .select("*, profiles(full_name, role)")
          .eq("ticket_id", ticketId)
          .order("created_at", { ascending: true }),
      ])

      setCurrentAdminId(authData.user?.id ?? null)

      if (ticketError) throw new Error(ticketError.message)
      if (!ticketRow) throw new Error("Ticket not found")

      const t = ticketRow as unknown as AdminSupportTicketRow & {
        profiles: { full_name: string; email: string; role: string } | null
      }
      setTicket({
        ...t,
        requester_name: t.profiles?.full_name ?? "Unknown user",
        requester_email: t.profiles?.email ?? "",
        requester_role: t.profiles?.role ?? "",
      })

      if (messagesError) throw new Error(messagesError.message)
      const rows = (messageRows ?? []) as unknown as RawMessageRow[]
      setMessages(
        rows.map((m) => ({
          ...m,
          sender_name: m.profiles?.full_name ?? "Unknown",
          sender_role: m.profiles?.role ?? "",
        }))
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load ticket")
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    load()
  }, [load])

  const patchTicket = async (
    patch: { status?: SupportTicketStatus; priority?: SupportTicketPriority; assigned_admin_id?: string | null }
  ) => {
    if (!ticket) return
    const previous = ticket
    setTicket({ ...ticket, ...patch })
    setFieldError(null)
    try {
      const res = await fetch("/api/admin/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: ticket.id, ...patch }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Update failed")
    } catch (e: unknown) {
      // Roll back on failure — never leave the UI showing a state the
      // server rejected.
      setTicket(previous)
      setFieldError(e instanceof Error ? e.message : "Update failed")
    }
  }

  const handleStatusChange = async (status: SupportTicketStatus) => {
    setStatusSaving(true)
    await patchTicket({ status })
    setStatusSaving(false)
  }

  const handlePriorityChange = async (priority: SupportTicketPriority) => {
    setPrioritySaving(true)
    await patchTicket({ priority })
    setPrioritySaving(false)
  }

  const handleAssignToMe = async () => {
    if (!currentAdminId) return
    setAssignSaving(true)
    await patchTicket({ assigned_admin_id: currentAdminId })
    setAssignSaving(false)
  }

  const handleSend = async () => {
    const trimmed = replyBody.trim()
    if (!trimmed || !ticket) return

    setSending(true)
    setSendError(null)
    optimisticIdRef.current += 1
    const tempId = `optimistic-${optimisticIdRef.current}`
    const optimisticMessage: TicketMessage = {
      id: tempId,
      ticket_id: ticket.id,
      sender_id: currentAdminId ?? "",
      body: trimmed,
      is_internal: isInternal,
      created_at: new Date().toISOString(),
      sender_name: "You",
      sender_role: "admin",
    }
    setMessages((prev) => [...prev, optimisticMessage])
    setReplyBody("")

    try {
      const res = await fetch("/api/admin/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: ticket.id, body: trimmed, is_internal: isInternal }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Failed to send message")
      await load()
    } catch (e: unknown) {
      // Roll back the optimistic message and restore the draft so nothing
      // is silently lost.
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setReplyBody(trimmed)
      setSendError(e instanceof Error ? e.message : "Failed to send message")
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-lg border border-border bg-surface" />
        <div className="h-16 animate-pulse rounded-lg border border-border bg-surface" />
        <div className="h-16 animate-pulse rounded-lg border border-border bg-surface" />
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-accent-danger" />
        <p className="mt-2 text-sm text-accent-danger">{error ?? "Ticket not found"}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => load()}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-text-primary">{ticket.subject}</h2>
            <p className="mt-1 text-sm text-text-muted">
              {ticket.requester_name} ({ticket.requester_email}) &middot; {ticket.requester_role}
            </p>
            <p className="mt-1 font-mono text-xs tabular-nums text-text-muted">
              Opened {ticket.created_at ? formatDateTime(ticket.created_at) : "—"}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={assignSaving || ticket.assigned_admin_id === currentAdminId}
            onClick={handleAssignToMe}
          >
            {assignSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
            {ticket.assigned_admin_id === currentAdminId ? "Assigned to you" : "Assign to me"}
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-text-muted">
            Status
            <select
              value={ticket.status}
              disabled={statusSaving}
              onChange={(e) => handleStatusChange(e.target.value as SupportTicketStatus)}
              className="h-8 rounded-md border border-border bg-surface-elevated px-2 text-xs text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Badge variant={STATUS_BADGE[ticket.status]}>{ticket.status}</Badge>
          </label>

          <label className="flex items-center gap-2 text-xs text-text-muted">
            Priority
            <select
              value={ticket.priority}
              disabled={prioritySaving}
              onChange={(e) => handlePriorityChange(e.target.value as SupportTicketPriority)}
              className="h-8 rounded-md border border-border bg-surface-elevated px-2 text-xs text-text-primary focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <Badge variant={PRIORITY_BADGE[ticket.priority]}>{ticket.priority}</Badge>
          </label>
        </div>

        {fieldError && <p className="mt-3 text-xs text-accent-danger">{fieldError}</p>}
      </div>

      <div className="space-y-3">
        {messages.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-8 text-center">
            <p className="text-sm text-text-muted">No messages yet — reply below to start the conversation.</p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "rounded-lg border p-4",
                m.is_internal ? "border-accent-warning/30 bg-accent-warning/5" : "border-border bg-surface"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-text-primary">
                  {m.sender_name}
                  <span className="ml-2 text-xs font-normal text-text-muted">{m.sender_role}</span>
                </p>
                <div className="flex items-center gap-2">
                  {m.is_internal && (
                    <Badge variant="warning" className="gap-1">
                      <Lock className="h-3 w-3" />
                      Internal only
                    </Badge>
                  )}
                  <span className="font-mono text-xs tabular-nums text-text-muted">
                    {m.created_at ? formatDateTime(m.created_at) : "—"}
                  </span>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-text-primary">{m.body}</p>
            </div>
          ))
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <textarea
          value={replyBody}
          onChange={(e) => setReplyBody(e.target.value)}
          rows={3}
          placeholder="Write a reply the requester will see, or check 'internal note' for admin-only context"
          className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border accent-accent-primary"
            />
            Internal note (admins only)
          </label>
          <Button variant="aurora" size="sm" disabled={sending || !replyBody.trim()} onClick={handleSend}>
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {isInternal ? "Add Internal Note" : "Send Reply"}
          </Button>
        </div>
        {sendError && <p className="mt-2 text-xs text-accent-danger">{sendError}</p>}
      </div>
    </div>
  )
}
