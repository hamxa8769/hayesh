"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, MessageSquareQuote } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusPill, type PillTone } from "@/components/teacher/StatusPill"
import { StarDisplay } from "@/components/orders/GigReviewForm"
import { cn } from "@/lib/utils/cn"
import { formatDate } from "@/lib/utils/format"
import type { AdminGigReview, AdminGigReviewsResponse } from "@/app/api/admin/gig-reviews/route"
import type { GigReviewStatus, PlatformSetting } from "@/types/database"

type Tab = "pending" | "published" | "hidden" | "all"
const TABS: { value: Tab; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "published", label: "Published" },
  { value: "hidden", label: "Hidden" },
  { value: "all", label: "All" },
]
const STATUS_TONE: Record<GigReviewStatus, PillTone> = { published: "success", pending: "warning", hidden: "neutral" }

type ToggleKey = "gig_reviews_enabled" | "gig_reviews_moderation"
const TOGGLES: { key: ToggleKey; label: string; hint: string }[] = [
  { key: "gig_reviews_enabled", label: "Show gig reviews publicly", hint: "When off, gig pages hide all reviews." },
  {
    key: "gig_reviews_moderation",
    label: "Require approval before reviews are published",
    hint: "New reviews wait in Pending until you publish them.",
  },
]

function asBool(value: PlatformSetting["value"] | undefined, fallback: boolean): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "string") return value === "true"
  return fallback
}

export function GigReviewModeration() {
  const [tab, setTab] = useState<Tab>("pending")
  const [items, setItems] = useState<AdminGigReview[]>([])
  const [counts, setCounts] = useState<AdminGigReviewsResponse["counts"]>({ all: 0, pending: 0, published: 0, hidden: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean> | null>(null)
  const [toggleBusy, setToggleBusy] = useState<ToggleKey | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)

  const load = useCallback(async (status: Tab) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/gig-reviews?status=${status}`)
      const json = (await res.json()) as Partial<AdminGigReviewsResponse> & { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Could not load reviews")
      setItems(json.items ?? [])
      if (json.counts) setCounts(json.counts)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load reviews")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(tab)
  }, [load, tab])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/admin/settings")
        const json = (await res.json()) as { settings?: PlatformSetting[]; error?: string }
        if (!res.ok) throw new Error(json.error ?? "Could not load settings")
        const byKey = new Map((json.settings ?? []).map((s) => [s.key, s.value]))
        if (!cancelled) {
          setToggles({
            gig_reviews_enabled: asBool(byKey.get("gig_reviews_enabled"), true),
            gig_reviews_moderation: asBool(byKey.get("gig_reviews_moderation"), false),
          })
        }
      } catch (e: unknown) {
        if (!cancelled) setToggleError(e instanceof Error ? e.message : "Could not load settings")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const flip = async (key: ToggleKey) => {
    if (!toggles) return
    const next = !toggles[key]
    setToggleBusy(key)
    setToggleError(null)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { [key]: next } }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Could not save setting")
      setToggles({ ...toggles, [key]: next })
    } catch (e: unknown) {
      setToggleError(e instanceof Error ? e.message : "Could not save setting")
    } finally {
      setToggleBusy(null)
    }
  }

  const act = async (review: AdminGigReview, action: "publish" | "hide" | "delete") => {
    if (action === "delete" && !window.confirm("Delete this review permanently? This cannot be undone.")) return
    setBusyId(review.id)
    setError(null)
    try {
      const res = await fetch("/api/admin/gig-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: review.id, action }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Action failed")
      await load(tab)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-surface p-4 sm:p-6">
        <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Review settings</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {TOGGLES.map((t) => (
            <label
              key={t.key}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-surface-elevated p-3"
            >
              <input
                type="checkbox"
                checked={toggles?.[t.key] ?? false}
                disabled={!toggles || toggleBusy !== null}
                onChange={() => void flip(t.key)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--color-accent-primary)]"
              />
              <span className="min-w-0">
                <span className="block text-sm text-text-primary">{t.label}</span>
                <span className="block text-xs text-text-muted">{t.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {toggleError && (
          <p role="alert" className="mt-3 text-sm text-accent-danger">
            {toggleError}
          </p>
        )}
      </section>

      <div role="tablist" aria-label="Review status" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60",
              tab === t.value
                ? "border-accent-primary/50 bg-accent-primary/10 text-text-primary"
                : "border-border text-text-muted hover:text-text-primary",
            )}
          >
            {t.label} <span className="font-mono tabular-nums text-xs">{counts[t.value]}</span>
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 p-4 text-sm text-accent-danger">
          {error}
          <Button variant="outline" size="sm" className="ml-3" onClick={() => void load(tab)}>
            Try again
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg border border-border bg-surface" />
          ))}
        </div>
      ) : items.length === 0 && !error ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <MessageSquareQuote className="mx-auto h-8 w-8 text-text-muted" aria-hidden="true" />
          <p className="mt-3 text-sm text-text-muted">No {tab === "all" ? "" : `${tab} `}reviews.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <StarDisplay rating={r.rating} />
                  <StatusPill label={r.status} tone={STATUS_TONE[r.status]} />
                </div>
                <span className="font-mono text-xs tabular-nums text-text-muted">
                  {r.created_at ? formatDate(r.created_at) : "—"}
                </span>
              </div>
              {r.comment ? (
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-text-primary">{r.comment}</p>
              ) : (
                <p className="mt-2 text-sm italic text-text-muted">No comment.</p>
              )}
              {r.seller_reply && (
                <p className="mt-2 break-words border-t border-border pt-2 text-sm text-text-muted">
                  <span className="font-mono text-xs uppercase tracking-[0.12em]">Seller reply</span>
                  <br />
                  {r.seller_reply}
                </p>
              )}
              <p className="mt-2 text-xs text-text-muted">
                {r.reviewer_name} on{" "}
                <Link href={`/marketplace/${r.gig_id}`} className="text-accent-secondary hover:underline">
                  {r.gig_title}
                </Link>{" "}
                · seller {r.seller_name}
              </p>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                {busyId === r.id && <Loader2 className="h-4 w-4 animate-spin self-center text-text-muted" aria-label="Working" />}
                {r.status !== "published" && (
                  <Button size="sm" variant="outline" disabled={busyId !== null} onClick={() => void act(r, "publish")}>
                    Publish
                  </Button>
                )}
                {r.status !== "hidden" && (
                  <Button size="sm" variant="outline" disabled={busyId !== null} onClick={() => void act(r, "hide")}>
                    Hide
                  </Button>
                )}
                <Button size="sm" variant="destructive" disabled={busyId !== null} onClick={() => void act(r, "delete")}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
