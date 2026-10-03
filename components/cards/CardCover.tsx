import type { ReactNode } from "react"
import {
  Bot,
  Briefcase,
  Clapperboard,
  Code2,
  Megaphone,
  Music,
  Package,
  Palette,
  PenLine,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils/cn"

const CATEGORY_ICONS: Array<{ match: RegExp; icon: LucideIcon; tint: "jade" | "gold" }> = [
  { match: /design|graphic|logo|brand|art|illustr/i, icon: Palette, tint: "gold" },
  { match: /program|develop|code|web|software|app/i, icon: Code2, tint: "jade" },
  { match: /writ|content|copy|translat|edit/i, icon: PenLine, tint: "gold" },
  { match: /video|animat|film/i, icon: Clapperboard, tint: "jade" },
  { match: /market|seo|social|ads/i, icon: Megaphone, tint: "gold" },
  { match: /music|audio|voice|sound/i, icon: Music, tint: "jade" },
  { match: /business|consult|finance|account/i, icon: Briefcase, tint: "jade" },
  { match: /\bai\b|artificial|machine|data/i, icon: Sparkles, tint: "gold" },
]

export function resolveCategory(category: string): { icon: LucideIcon; tint: "jade" | "gold" } {
  const hit = CATEGORY_ICONS.find((entry) => entry.match.test(category))
  return hit ? { icon: hit.icon, tint: hit.tint } : { icon: Package, tint: "jade" }
}

export { Bot as AiServiceIcon }

interface CardCoverProps {
  category: string
  imageUrl: string | null
  alt?: string
  /** Overrides the category-derived icon (e.g. the AI Bot icon on /explore). */
  icon?: LucideIcon
  className?: string
  children?: ReactNode
}

/**
 * 16:10 cover. Shows the gallery image when present, otherwise a quiet
 * generated cover: tinted obsidian gradient + faint grid + category icon.
 * Never the full aurora gradient.
 */
export function CardCover({ category, imageUrl, alt = "", icon, className, children }: CardCoverProps) {
  const resolved = resolveCategory(category)
  const Icon = icon ?? resolved.icon
  const tintVar = resolved.tint === "jade" ? "var(--color-accent-primary)" : "var(--color-accent-secondary)"

  return (
    <div className={cn("relative aspect-[16/10] w-full shrink-0 overflow-hidden border-b border-border bg-surface-elevated", className)}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 motion-reduce:transition-none group-hover:scale-[1.02]"
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage: [
              `radial-gradient(120% 90% at 85% 0%, color-mix(in srgb, ${tintVar} 20%, transparent), transparent 60%)`,
              `linear-gradient(var(--color-border) 1px, transparent 1px)`,
              `linear-gradient(90deg, var(--color-border) 1px, transparent 1px)`,
            ].join(", "),
            backgroundSize: "auto, 28px 28px, 28px 28px",
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-line-strong bg-surface/70 sm:h-16 sm:w-16"
              style={{ color: tintVar }}
            >
              <Icon className="h-6 w-6 sm:h-8 sm:w-8" strokeWidth={1.5} />
            </div>
          </div>
        </div>
      )}
      {children}
    </div>
  )
}
