"use client"

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { DotItemDotProps } from "recharts"
import { formatPKR } from "@/lib/utils/format"

export interface EarningsPoint {
  label: string
  amount: number
}

export interface EarningsAreaChartProps {
  data: EarningsPoint[]
}

function EndpointDot(props: DotItemDotProps & { totalPoints: number }) {
  const { cx, cy, index, totalPoints } = props
  if (cx == null || cy == null) return <svg />
  const isLast = index === totalPoints - 1
  if (!isLast) return <svg />
  return <circle cx={cx} cy={cy} r={4} fill="var(--color-gold)" stroke="var(--color-surface)" strokeWidth={2} />
}

function EarningsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="glass rounded-md border border-border px-3 py-2 text-xs shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
      <p className="font-mono uppercase tracking-[0.1em] text-text-muted">{label}</p>
      <p className="mt-1 font-mono font-semibold tabular-nums text-text-primary">{formatPKR(payload[0].value)}</p>
    </div>
  )
}

export function EarningsAreaChart({ data }: EarningsAreaChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-border bg-surface text-sm text-text-muted">
        No earnings history yet
      </div>
    )
  }

  return (
    <div className="h-64 w-full rounded-lg border border-border bg-surface p-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="earningsAurora" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--color-jade)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-gold)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--color-text-muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={{ stroke: "var(--color-border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--color-text-muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(v: number) => formatPKR(v)}
          />
          <Tooltip content={<EarningsTooltip />} cursor={{ stroke: "var(--color-jade)", strokeOpacity: 0.3 }} />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="var(--color-jade)"
            strokeWidth={2}
            fill="url(#earningsAurora)"
            dot={(props: DotItemDotProps) => <EndpointDot key={props.index} {...props} totalPoints={data.length} />}
            activeDot={{ r: 4, fill: "var(--color-gold)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
