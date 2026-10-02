"use client"

import { cn } from "@/lib/utils/cn"
import type { ConversationListItem } from "@/app/api/messages/conversations/route"

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
}

export function Avatar({ name, url, className }: { name: string; url: string | null; className?: string }) {
  if (url && /^https?:\/\//i.test(url)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={cn("h-9 w-9 shrink-0 rounded-full object-cover", className)} />
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-primary/15 font-mono text-xs font-semibold text-accent-primary",
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}

export interface ConversationListProps {
  items: ConversationListItem[]
  activeId: string | null
  onSelect: (id: string) => void
}

export function ConversationList({ items, activeId, onSelect }: ConversationListProps) {
  return (
    <ul className="h-full divide-y divide-border overflow-y-auto">
      {items.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => onSelect(c.id)}
            className={cn(
              "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-elevated",
              c.id === activeId && "bg-surface-elevated",
            )}
          >
            <Avatar name={c.other_name} url={c.other_avatar_url} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-text-primary">{c.other_name}</span>
                {c.unread_count > 0 && (
                  <span aria-label={`${c.unread_count} unread`} className="h-2 w-2 shrink-0 rounded-full bg-accent-primary" />
                )}
              </span>
              <span className="block truncate font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
                {c.context_label}
              </span>
              <span className={cn("block truncate text-xs", c.unread_count > 0 ? "text-text-primary" : "text-text-muted")}>
                {c.last_message_preview ?? "No messages yet"}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
