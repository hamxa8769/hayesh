"use client"

import { Reveal } from "@/components/motion/Reveal"
import { SupportTicketPanel } from "@/components/teacher/SupportTicketPanel"
import { useSupabase } from "@/hooks/useSupabase"

export default function TeacherSupportPage() {
  const { user, loading } = useSupabase()

  return (
    <div className="space-y-6">
      <Reveal>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text-primary">Support</h2>
        <p className="mt-1 text-sm text-text-muted">Raise an issue and hear back from the Hayesh team.</p>
      </Reveal>

      {loading ? (
        <p className="text-text-muted">Loading...</p>
      ) : user ? (
        <SupportTicketPanel userId={user.id} />
      ) : (
        <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-4 text-sm text-accent-danger">
          You must be signed in to view support tickets.
        </div>
      )}
    </div>
  )
}
