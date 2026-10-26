import { createAdminClient } from "@/lib/supabase/admin"

if (typeof window !== "undefined") {
  throw new Error("lib/payments/webhook-events.ts must never be imported client-side")
}

/** A claimed-but-unfinished event older than this is assumed crashed and may be retried. */
export const STALE_CLAIM_MS = 10 * 60 * 1000

export type ClaimResult = "new" | "duplicate" | "in_progress"

/** Whether an unfinished claim has been abandoned long enough to re-process. */
export function isStaleClaim(row: { processed_at: string | null; received_at: string }, now = Date.now()): boolean {
  return row.processed_at === null && now - new Date(row.received_at).getTime() > STALE_CLAIM_MS
}

/** Existing-claim state: finished, still being worked on, or abandoned. */
export function classifyExistingClaim(
  row: { processed_at: string | null; received_at: string },
  now = Date.now(),
): "duplicate" | "in_progress" | "stale" {
  if (row.processed_at !== null) return "duplicate"
  return isStaleClaim(row, now) ? "stale" : "in_progress"
}

/**
 * Records that this instance is handling (provider, eventId). Returns
 * "duplicate" when the event was already fully processed, "in_progress" when
 * another delivery holds an unfinished, non-stale claim (callers answer 503 so
 * the provider retries), and "new" when we own it (including stale takeover).
 */
export async function claimWebhookEvent(provider: string, eventId: string): Promise<ClaimResult> {
  const admin = createAdminClient()
  const { error } = await admin.from("payment_webhook_events").insert({ provider, event_id: eventId })
  if (!error) return "new"
  if (error.code !== "23505") throw new Error(`Could not record webhook event: ${error.message}`)

  const { data: row } = await admin
    .from("payment_webhook_events")
    .select("processed_at, received_at")
    .eq("provider", provider)
    .eq("event_id", eventId)
    .maybeSingle()
  if (!row) return "in_progress"
  const state = classifyExistingClaim(row as { processed_at: string | null; received_at: string })
  if (state !== "stale") return state

  // Compare-and-set on the old received_at so only one retry takes over.
  const { data: taken } = await admin
    .from("payment_webhook_events")
    .update({ received_at: new Date().toISOString() })
    .eq("provider", provider)
    .eq("event_id", eventId)
    .is("processed_at", null)
    .eq("received_at", (row as { received_at: string }).received_at)
    .select("event_id")
    .maybeSingle()
  return taken ? "new" : "in_progress"
}

export async function finishWebhookEvent(provider: string, eventId: string, outcome: string, transactionId?: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("payment_webhook_events")
    .update({ processed_at: new Date().toISOString(), outcome, transaction_id: transactionId ?? null })
    .eq("provider", provider)
    .eq("event_id", eventId)
  if (error) console.error("finishWebhookEvent failed", provider, eventId, error.message)
}

/**
 * Drops an unfinished claim so the provider's retry is processed as "new".
 * Use before answering 5xx (unknown transaction, settle failure).
 */
export async function releaseWebhookEvent(provider: string, eventId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("payment_webhook_events")
    .delete()
    .eq("provider", provider)
    .eq("event_id", eventId)
    .is("processed_at", null)
  if (error) console.error("releaseWebhookEvent failed", provider, eventId, error.message)
}
