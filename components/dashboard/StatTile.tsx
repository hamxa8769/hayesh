import { cn } from "@/lib/utils/cn"
import { Sparkline } from "@/components/dashboard/Sparkline"

export interface StatTileDelta {
  value: string
  direction: "up" | "down" | "flat"
}

export interface StatTileProps {
  label: string
  value: string | number
  delta?: StatTileDelta
  spark?: number[]
  accent?: boolean
  className?: string
}

const deltaColors: Record<StatTileDelta["direction"], string> = {
  up: "text-accent-success",
  down: "text-accent-danger",
  flat: "text-text-muted",
}

const deltaGlyphs: Record<StatTileDelta["direction"], string> = {
  up: "▲",
  down: "▼",
  flat: "•",
}

export function StatTile({ label, value, delta, spark, accent = false, className }: StatTileProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg border border-border bg-surface p-4", className)}>
      {accent && <span aria-hidden="true" className="aurora-bg absolute inset-x-0 top-0 h-[2px]" />}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">{label}</p>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-text-primary">{value}</p>
          {delta && (
            <p className={cn("mt-1 flex items-center gap-1 font-mono text-xs tabular-nums", deltaColors[delta.direction])}>
              <span aria-hidden="true">{deltaGlyphs[delta.direction]}</span>
              {delta.value}
            </p>
          )}
        </div>
        {spark && spark.length > 0 && (
          <Sparkline data={spark} width={80} height={32} className="mt-1 shrink-0" />
        )}
      </div>
    </div>
  )
}
