import type { ReactNode } from "react"
import { Navbar } from "@/components/layout/Navbar"
import { LandingFooter } from "@/components/marketing/LandingFooter"
import { SITE_INFO } from "@/lib/site-info"

export interface LegalSection {
  id: string
  heading: string
  body: ReactNode
}

interface LegalPageProps {
  title: string
  intro: ReactNode
  sections: LegalSection[]
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

export function LegalPage({ title, intro, sections }: LegalPageProps) {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-28 sm:px-6">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Legal</p>
        <h1 className="mt-3 text-balance font-display text-4xl font-bold tracking-tight">{title}</h1>
        <p className="mt-3 font-mono text-xs uppercase tracking-[0.12em] text-text-disabled">
          Last updated {SITE_INFO.lastUpdated}
        </p>
        <div className="mt-6 max-w-[65ch] text-base leading-relaxed text-text-muted">{intro}</div>

        <nav aria-label="Table of contents" className="mt-10 rounded-lg border border-border bg-surface p-5">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Contents</p>
          <ol className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="flex gap-3 py-1.5 text-sm text-text-muted transition-colors duration-150 hover:text-text-primary sm:py-0.5"
                >
                  <span className="font-mono tabular-nums text-text-disabled">{pad(i + 1)}</span>
                  <span>{s.heading}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-12 flex flex-col gap-12">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <p className="font-mono text-xs uppercase tracking-[0.12em] tabular-nums text-text-muted">
                Section {pad(i + 1)}
              </p>
              <h2 className="mt-2 text-balance font-display text-2xl font-semibold tracking-tight">{s.heading}</h2>
              <div className="mt-4 flex max-w-[65ch] flex-col gap-4 text-base leading-relaxed text-text-muted [&_a]:text-accent-secondary [&_a]:underline [&_li]:pl-1 [&_strong]:font-medium [&_strong]:text-text-primary [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2">
                {s.body}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-16 rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
          This document is provided for transparency and should be reviewed by a qualified lawyer before relying on it.
        </p>
      </main>
      <LandingFooter />
    </div>
  )
}
