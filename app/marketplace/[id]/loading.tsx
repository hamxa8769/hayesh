function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-surface-elevated ${className}`} />
}

export default function GigDetailLoading() {
  return (
    <div className="pb-16 pt-6" aria-busy="true" aria-label="Loading service">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <Bar className="mb-6 h-4 w-64" />
        <div className="grid gap-x-12 gap-y-10 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-1">
            <div className="flex flex-col gap-4">
              <Bar className="h-9 w-11/12" />
              <Bar className="h-9 w-2/3" />
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 animate-pulse rounded-full bg-surface-elevated" />
                <Bar className="h-4 w-56" />
              </div>
            </div>
            <div className="aspect-[16/10] w-full animate-pulse rounded-lg border border-border bg-surface-elevated" />
          </div>

          <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className="grid grid-cols-3 border-b border-border">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex justify-center py-4">
                    <Bar className="h-4 w-14" />
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-4 p-5">
                <div className="flex justify-between gap-4">
                  <Bar className="h-5 w-32" />
                  <Bar className="h-7 w-24" />
                </div>
                <Bar className="h-16 w-full" />
                <Bar className="h-4 w-48" />
                <Bar className="h-24 w-full" />
                <Bar className="h-12 w-full" />
                <Bar className="h-10 w-full" />
              </div>
            </div>
          </aside>

          <div className="flex min-w-0 flex-col gap-14 lg:col-start-1 lg:row-start-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-4">
                <Bar className="h-3 w-24" />
                <Bar className="h-6 w-56" />
                <Bar className="h-4 w-full" />
                <Bar className="h-4 w-11/12" />
                <Bar className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
