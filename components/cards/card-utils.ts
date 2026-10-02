export function getInitials(name: string | null | undefined): string {
  if (!name) return "?"
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
  return initials || "?"
}

/** Shared hover/focus classes for every listing card (one Link wrapping the card). */
export const CARD_LINK_CLASS =
  "group block h-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"

export const CARD_SURFACE_CLASS =
  "flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface transition-[transform,border-color,background-color] duration-150 group-hover:-translate-y-0.5 group-hover:border-line-strong group-hover:bg-surface-elevated motion-reduce:transition-colors motion-reduce:group-hover:translate-y-0"
