import type { ReactNode } from "react"
import Link from "next/link"

interface JarvisMarkdownProps {
  text: string
}

const INLINE_RE = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g
const LINK_CLASS = "text-accent-secondary underline underline-offset-2 hover:text-text-primary"

function isRelative(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//")
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of text.matchAll(INLINE_RE)) {
    const start = m.index ?? 0
    if (start > last) out.push(text.slice(last, start))
    const key = `${keyPrefix}-${i++}`
    if (m[3] !== undefined) {
      out.push(<strong key={key} className="font-semibold">{m[3]}</strong>)
    } else if (isRelative(m[2])) {
      out.push(<Link key={key} href={m[2]} className={LINK_CLASS}>{m[1]}</Link>)
    } else {
      // Only in-app links are clickable: model output can be steered by
      // user-written text (gig titles, messages), so external URLs render
      // as plain text to rule out phishing links.
      out.push(m[0])
    }
    last = start + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const LIST_RE = /^\s*(?:[-*]|\d+\.)\s+(.*)$/

/** Minimal safe markdown: bold, lists, line breaks and links. No raw HTML. */
export function JarvisMarkdown({ text }: JarvisMarkdownProps) {
  const lines = text.split("\n")
  const blocks: ReactNode[] = []
  let items: string[] = []

  const flushList = (idx: number) => {
    if (items.length === 0) return
    blocks.push(
      <ul key={`ul-${idx}`} className="my-1 list-disc space-y-0.5 pl-5">
        {items.map((it, j) => (
          <li key={j}>{renderInline(it, `li-${idx}-${j}`)}</li>
        ))}
      </ul>
    )
    items = []
  }

  lines.forEach((line, idx) => {
    const li = LIST_RE.exec(line)
    if (li) {
      items.push(li[1])
      return
    }
    flushList(idx)
    if (line.trim() === "") return
    blocks.push(
      <p key={`p-${idx}`} className="[&:not(:first-child)]:mt-2">
        {renderInline(line, `p-${idx}`)}
      </p>
    )
  })
  flushList(lines.length)

  return <div className="break-words">{blocks}</div>
}
