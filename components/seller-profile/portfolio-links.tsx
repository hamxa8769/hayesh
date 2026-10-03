import { ExternalLink } from "lucide-react"

const IMAGE_RE = /\.(png|jpe?g|webp|gif|avif|svg)(\?.*)?$/i

function safeHttpUrl(raw: string): URL | null {
  try {
    const u = new URL(raw)
    return u.protocol === "http:" || u.protocol === "https:" ? u : null
  } catch {
    return null
  }
}

export function PortfolioLinks({ urls, name }: { urls: string[]; name: string }) {
  const items = urls.map((raw) => ({ raw, url: safeHttpUrl(raw) })).filter((i): i is { raw: string; url: URL } => i.url !== null)
  if (items.length === 0) return null
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map(({ raw, url }, i) => (
        <li key={raw}>
          <a
            href={url.toString()}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-line-strong hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60"
          >
            {IMAGE_RE.test(url.pathname) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={raw} alt={`${name} portfolio item ${i + 1}`} loading="lazy" className="aspect-[16/10] w-full object-cover" />
            ) : (
              <span className="flex flex-1 items-center justify-between gap-2 px-4 py-4 text-sm text-text-primary">
                <span className="min-w-0 truncate">{url.hostname.replace(/^www\./, "")}</span>
                <ExternalLink className="h-4 w-4 shrink-0 text-text-muted group-hover:text-text-primary" aria-hidden="true" />
              </span>
            )}
          </a>
        </li>
      ))}
    </ul>
  )
}
