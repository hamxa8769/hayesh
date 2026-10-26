export default function AuditLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <div className="h-3 w-32 animate-pulse rounded bg-surface-elevated" />
        <div className="h-8 w-48 animate-pulse rounded bg-surface-elevated" />
      </div>
      <div className="space-y-2 rounded-lg border border-border bg-surface p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-surface-elevated" />
        ))}
      </div>
    </div>
  )
}
