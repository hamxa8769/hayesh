"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Reveal } from "@/components/motion/Reveal"
import { TicketThread } from "@/components/admin/TicketThread"

export default function AdminSupportTicketPage() {
  const params = useParams<{ id: string }>()
  const ticketId = params.id

  return (
    <div className="space-y-8">
      <Reveal>
        <Link
          href="/admin/support"
          className="inline-flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Support Inbox
        </Link>
        <p className="mt-3 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Admin / Support / Ticket</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-text-primary sm:text-3xl">Ticket Thread</h1>
      </Reveal>

      <TicketThread ticketId={ticketId} />
    </div>
  )
}
