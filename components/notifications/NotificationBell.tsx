"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Bell } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { NotificationList } from "@/components/notifications/NotificationList"
import type { Notification } from "@/types/database"

const POLL_INTERVAL_MS = 60_000
const MAX_BADGE_COUNT = 9

interface NotificationsGetResponse {
  notifications: Notification[]
  unreadCount: number
}

interface NotificationBellProps {
  /**
   * Whether a signed-in user is present. Passed down from Navbar, which
   * already resolves the session via useSupabase() — this component never
   * calls Supabase auth itself, so mounting it never triggers a second
   * auth fetch.
   */
  isAuthed: boolean
}

/**
 * Floating notification bell mounted in the Navbar for authenticated users.
 *
 * Realtime note: this polls /api/notifications every 60s rather than
 * subscribing to Supabase Realtime. There is no existing Realtime
 * subscription anywhere else in this codebase to pattern-match against, and
 * guessing the `postgres_changes` filter syntax against a live table risks a
 * silently-broken subscription that never fires — polling is the safe,
 * verifiable choice here.
 */
export function NotificationBell({ isAuthed }: NotificationBellProps) {
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()

  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const bellRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications")
      if (!res.ok) return
      const data = (await res.json()) as NotificationsGetResponse
      setNotifications(data.notifications ?? [])
      setUnreadCount(data.unreadCount ?? 0)
    } catch {
      // Network error — keep last known state, never crash the bell over this.
    }
  }, [])

  useEffect(() => {
    if (!isAuthed) return
    fetchNotifications()
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [isAuthed, fetchNotifications])

  // Escape-closes / focus-into-overlay / focus-restored-on-close, matching
  // the pattern in components/layout/Navbar.tsx's account menu.
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>("button, a")?.focus()
    })
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (panelRef.current?.contains(target) || bellRef.current?.contains(target)) return
      setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("mousedown", onClickOutside)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("mousedown", onClickOutside)
      bellRef.current?.focus()
    }
  }, [open])

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    setUnreadCount((prev) => Math.max(0, prev - 1))
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
    } catch {
      // Best-effort — local state already reflects "read"; a background
      // resync on the next poll will reconcile if this request failed.
    }
  }, [])

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      })
    } catch {
      // Best-effort, same reasoning as markRead.
    }
  }, [])

  const handleItemClick = useCallback(
    (item: Notification) => {
      if (!item.read) {
        void markRead(item.id)
      }
      setOpen(false)
      if (item.action_url) {
        router.push(item.action_url)
      }
    },
    [markRead, router]
  )

  // Identical neutral output on the server and the first client render:
  // Navbar only flips isAuthed to true after its own auth resolution
  // finishes client-side, so both the server render and the first client
  // render see isAuthed=false here and render nothing. Populating happens
  // only after mount, inside the effects above.
  if (!isAuthed) return null

  const badgeLabel = unreadCount > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : String(unreadCount)

  return (
    <div className="relative">
      <button
        ref={bellRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-elevated text-text-muted transition-colors hover:border-accent-primary/50 hover:text-text-primary"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-danger px-1 font-mono text-[10px] font-semibold leading-none text-white"
            aria-hidden="true"
          >
            {badgeLabel}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={
              prefersReducedMotion
                ? { duration: 0.15 }
                : { type: "spring", stiffness: 380, damping: 30 }
            }
            className={cn(
              "glass absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-lg border border-border shadow-[0_8px_30px_rgba(0,0,0,0.5)]",
              "max-w-[calc(100vw-2rem)]"
            )}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-medium text-text-primary">Notifications</p>
              <button
                type="button"
                onClick={() => void markAllRead()}
                disabled={unreadCount === 0}
                className="text-xs text-accent-primary transition-colors hover:underline disabled:cursor-not-allowed disabled:text-text-disabled disabled:no-underline"
              >
                Mark all read
              </button>
            </div>
            <NotificationList items={notifications} onItemClick={handleItemClick} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
