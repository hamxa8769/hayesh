"use client"

import { formatDistanceToNowStrict } from "date-fns"
import {
  Bell,
  CheckCircle2,
  ClipboardCheck,
  HandCoins,
  LifeBuoy,
  UserPlus,
  Video,
} from "lucide-react"
import type { ComponentType } from "react"
import { cn } from "@/lib/utils/cn"
import type { Notification } from "@/types/database"

interface NotificationListProps {
  items: Notification[]
  onItemClick: (item: Notification) => void
}

const TYPE_ICON: Record<string, ComponentType<{ className?: string }>> = {
  student_request_created: UserPlus,
  student_request_assigned: ClipboardCheck,
  support_ticket_created: LifeBuoy,
  assignment_created: ClipboardCheck,
  demo_booked: Video,
  payout_requested: HandCoins,
}

function iconForType(type: string): ComponentType<{ className?: string }> {
  return TYPE_ICON[type] ?? Bell
}

function relativeTime(createdAt: string | null): string {
  if (!createdAt) return ""
  try {
    return `${formatDistanceToNowStrict(new Date(createdAt))} ago`
  } catch {
    return ""
  }
}

/**
 * Presentational only — receives items + handlers as props, does no data
 * fetching itself. Used inside NotificationBell's dropdown panel.
 */
export function NotificationList({ items, onItemClick }: NotificationListProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <CheckCircle2 className="h-6 w-6 text-text-muted" aria-hidden="true" />
        <p className="text-sm text-text-muted">You&apos;re all caught up</p>
      </div>
    )
  }

  return (
    <ul className="max-h-80 overflow-y-auto" role="list">
      {items.map((item) => {
        const Icon = iconForType(item.type)
        const isUnread = !item.read

        return (
          <li key={item.id} className="border-b border-border last:border-b-0">
            <button
              type="button"
              onClick={() => onItemClick(item)}
              className={cn(
                "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-elevated",
                isUnread && "bg-surface-elevated/60"
              )}
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-muted">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "truncate text-sm",
                      isUnread ? "font-semibold text-text-primary" : "text-text-muted"
                    )}
                  >
                    {item.title}
                  </span>
                  {isUnread && (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-danger"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className="mt-0.5 block truncate text-xs text-text-muted">
                  {item.message}
                </span>
                <span className="mt-1 block font-mono text-[11px] text-text-disabled">
                  {relativeTime(item.created_at)}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
