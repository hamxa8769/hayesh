function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-surface-elevated ${className}`} />
}

export default function SellerLoading() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-6 sm:px-6" aria-busy="true" aria-label="Loading seller">
      <Bar className="mb-6 h-4 w-24" />
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="h-28 animate-pulse bg-surface-elevated" />
        <div className="flex flex-col gap-3 px-8 pb-6">
          <div className="-mt-12 h-24 w-24 animate-pulse rounded-full border-4 border-surface bg-surface-elevated" />
          <Bar className="h-8 w-64" />
          <Bar className="h-4 w-96 max-w-full" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-px sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Bar key={i} className="h-20" />)}
      </div>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="aspect-[4/3] animate-pulse rounded-lg bg-surface-elevated" />)}
      </div>
    </div>
  )
}
