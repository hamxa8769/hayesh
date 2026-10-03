interface Stat {
  label: string
  value: string
}

export function SellerStats({ stats }: { stats: Stat[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col gap-1.5 bg-surface px-5 py-4">
          <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">{s.label}</dt>
          <dd className="font-mono text-2xl font-semibold tabular-nums text-text-primary">{s.value}</dd>
        </div>
      ))}
    </dl>
  )
}
