import { cn } from "@/lib/utils/cn"
import { getInitials } from "@/components/cards/card-utils"

interface SellerAvatarProps {
  name: string
  url: string | null
  online?: boolean | null
  className?: string
  textClassName?: string
}

/** Round avatar (image or initials) with an optional online dot. */
export function SellerAvatar({ name, url, online, className = "h-10 w-10", textClassName = "text-xs" }: SellerAvatarProps) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-full w-full rounded-full border border-border object-cover" />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "flex h-full w-full items-center justify-center rounded-full border border-line-strong bg-surface-elevated font-mono font-semibold text-text-muted",
            textClassName
          )}
        >
          {getInitials(name)}
        </span>
      )}
      {online && (
        <span
          className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-accent-success"
          title="Online now"
        />
      )}
    </span>
  )
}
