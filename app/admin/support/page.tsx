"use client"

import { Reveal } from "@/components/motion/Reveal"
import { TicketList } from "@/components/admin/TicketList"

export default function AdminSupportPage() {
  return (
    <div className="space-y-8">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Admin / Support</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-text-primary sm:text-3xl">Support Inbox</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          Every ticket raised by a teacher, parent, seller, or buyer lands here.
        </p>
      </Reveal>

      <TicketList />
    </div>
  )
}
