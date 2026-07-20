"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Loader2, LifeBuoy, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils/cn"
import { formatDateTime } from "@/lib/utils/format"
import {
  supportTicketSchema,
  SUPPORT_CATEGORY_OPTIONS,
  SUPPORT_STATUS_LABEL,
  type SupportTicketRow,
  type SupportTicketMessageRow,
  type SupportTicketValues,
} from "@/components/teacher/teaching-schema"

export interface SupportTicketPanelProps {
  userId: string
}

const emptyValues: SupportTicketValues = { subject: "", category: SUPPORT_CATEGORY_OPTIONS[0].value, message: "" }

const STATUS_TONE: Record<string, string> = {
  open: "border-[#56B6FF]/30 bg-[#56B6FF]/10 text-[#56B6FF]",
  pending: "border-transparent bg-accent-warning/20 text-accent-warning",
  resolved: "border-transparent bg-accent-success/20 text-accent-success",
  closed: "border-line-strong bg-surface-elevated text-text-muted",
}

export function SupportTicketPanel({ userId }: SupportTicketPanelProps) {
  const [tickets, setTickets] = useState<SupportTicketRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketRow | null>(null)
  const [messages, setMessages] = useState<SupportTicketMessageRow[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [reply, setReply] = useState("")
  const [replySending, setReplySending] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupportTicketValues>({
    resolver: zodResolver(supportTicketSchema),
    defaultValues: emptyValues,
  })

  const loadTickets = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (error) throw error
      setTickets((data ?? []) as SupportTicketRow[])
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load your tickets")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTickets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const openTicket = async (ticket: SupportTicketRow) => {
    setSelectedTicket(ticket)
    setMessagesLoading(true)
    setMessagesError(null)
    try {
      const supabase = createClient()
      // is_internal admin-only rows are hidden by RLS regardless of this
      // select — "Owner sees own ticket messages" filters is_internal = false.
      const { data, error } = await supabase
        .from("support_ticket_messages")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true })

      if (error) throw error
      setMessages((data ?? []) as SupportTicketMessageRow[])
    } catch (e) {
      setMessages([])
      setMessagesError(e instanceof Error ? e.message : "Could not load this conversation")
    } finally {
      setMessagesLoading(false)
    }
  }

  const submitTicket = async (values: SupportTicketValues) => {
    setSubmitting(true)
    setFormError(null)
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const payload = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setFormError(payload?.error ?? "Something went wrong. Please try again.")
        return
      }
      reset(emptyValues)
      setShowNewForm(false)
      await loadTickets()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const sendReply = async () => {
    if (!selectedTicket || !reply.trim()) return
    setReplySending(true)
    setReplyError(null)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("support_ticket_messages")
        .insert({ ticket_id: selectedTicket.id, sender_id: userId, body: reply.trim() })
        .select("*")
        .maybeSingle()

      if (error) throw error
      if (data) setMessages((prev) => [...prev, data as SupportTicketMessageRow])
      setReply("")
    } catch (e) {
      // The reply text stays in the box on failure so nothing is lost, but
      // the failure itself must still be visible to the user.
      setReplyError(e instanceof Error ? e.message : "Could not send reply. Please try again.")
    } finally {
      setReplySending(false)
    }
  }

  if (selectedTicket) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
        <button
          onClick={() => setSelectedTicket(null)}
          className="flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to tickets
        </button>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-text-primary">{selectedTicket.subject}</h3>
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide",
              STATUS_TONE[selectedTicket.status] ?? STATUS_TONE.open
            )}
          >
            {SUPPORT_STATUS_LABEL[selectedTicket.status] ?? selectedTicket.status}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {messagesLoading ? (
            <p className="text-sm text-text-muted">Loading conversation...</p>
          ) : messagesError ? (
            <p className="text-sm text-accent-danger">{messagesError}</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-text-muted">No messages yet.</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[85%] rounded-lg border p-3 text-sm",
                  m.sender_id === userId
                    ? "ml-auto border-accent-primary/30 bg-accent-primary/10 text-text-primary"
                    : "border-border bg-surface-elevated text-text-primary"
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className="mt-1 font-mono text-[11px] tabular-nums text-text-muted">
                  {m.sender_id === userId ? "You" : "Support"} · {formatDateTime(m.created_at)}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <div className="flex items-end gap-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={2}
              placeholder="Write a reply..."
              className="flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
            />
            <Button type="button" size="icon" variant="aurora" onClick={sendReply} disabled={replySending || !reply.trim()}>
              {replySending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          {replyError && <p className="mt-1.5 text-xs text-accent-danger">{replyError}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-text-primary">My Tickets</h3>
        <Button variant="aurora" size="sm" onClick={() => setShowNewForm((v) => !v)}>
          <LifeBuoy className="h-3.5 w-3.5" /> {showNewForm ? "Cancel" : "Raise a Ticket"}
        </Button>
      </div>

      {showNewForm && (
        <form
          onSubmit={handleSubmit(submitTicket)}
          className="space-y-4 rounded-lg border border-border bg-surface p-4 sm:p-5"
        >
          <div className="space-y-1.5">
            <Label htmlFor="ticket-subject">Subject</Label>
            <Input id="ticket-subject" {...register("subject")} placeholder="Briefly describe the issue" />
            {errors.subject && <p className="text-xs text-accent-danger">{errors.subject.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ticket-category">Category</Label>
            <select
              id="ticket-category"
              {...register("category")}
              className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
            >
              {SUPPORT_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ticket-message">Message</Label>
            <textarea
              id="ticket-message"
              {...register("message")}
              rows={4}
              placeholder="What happened? Include as much detail as you can."
              className="flex w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
            />
            {errors.message && <p className="text-xs text-accent-danger">{errors.message.message}</p>}
          </div>

          {formError && <p className="text-sm text-accent-danger">{formError}</p>}

          <div className="flex justify-end">
            <Button type="submit" variant="aurora" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Ticket
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-text-muted">Loading tickets...</p>
      ) : loadError ? (
        <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-4 text-sm text-accent-danger">
          {loadError}
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <LifeBuoy className="mx-auto mb-3 h-12 w-12 text-text-disabled" />
          <p className="text-text-muted">No support tickets yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => openTicket(t)}
              className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-line-strong"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-text-primary">{t.subject}</p>
                <p className="font-mono text-xs tabular-nums text-text-muted">{formatDateTime(t.created_at)}</p>
              </div>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide",
                  STATUS_TONE[t.status] ?? STATUS_TONE.open
                )}
              >
                {SUPPORT_STATUS_LABEL[t.status] ?? t.status}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
