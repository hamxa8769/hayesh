"use client"

import { useEffect, useRef, useState } from "react"
import { BadgeCheck, Search, ShieldCheck, Video, X } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { useExploreNav, SoftLink } from "./ExploreNav"
import type { ExploreViewer } from "./explore-data"

const SUGGESTIONS = ["Maths tutor", "O-Level Physics", "Logo design", "IELTS", "CV rewrite"]

const TRUST = [
  { icon: BadgeCheck, label: "Verified teachers" },
  { icon: ShieldCheck, label: "Escrow-protected payments" },
  { icon: Video, label: "Free demo lessons" },
]

function greetingFor(hour: number): string {
  if (hour < 5) return "Good evening"
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

interface ExploreHeroProps {
  viewer: ExploreViewer | null
  resultsMode: boolean
}

export function ExploreHero({ viewer, resultsMode }: ExploreHeroProps) {
  const { params, update } = useExploreNav()
  const [value, setValue] = useState(params.q)
  const [greeting, setGreeting] = useState("Welcome back")
  const inputRef = useRef<HTMLInputElement>(null)
  const lastWritten = useRef(params.q)

  // Time-of-day is computed after mount so SSR and hydration agree.
  useEffect(() => {
    setGreeting(greetingFor(new Date().getHours()))
  }, [])

  // Back/forward or a chip changed ?q — mirror it into the field.
  useEffect(() => {
    if (params.q !== lastWritten.current) {
      lastWritten.current = params.q
      setValue(params.q)
    }
  }, [params.q])

  // Debounced write of the typed value into the URL.
  useEffect(() => {
    if (value === lastWritten.current) return
    const id = window.setTimeout(() => {
      lastWritten.current = value
      update({ q: value }, "replace")
    }, 250)
    return () => window.clearTimeout(id)
  }, [value, update])

  // "/" focuses the search field from anywhere (unless already typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return
      const el = document.activeElement
      if (el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const commit = () => {
    lastWritten.current = value
    update({ q: value }, "push")
  }

  const clear = () => {
    setValue("")
    lastWritten.current = ""
    update({ q: "" }, "push")
    inputRef.current?.focus()
  }

  const name = viewer?.firstName
  return (
    <section aria-label="Search Hayesh" className="flex flex-col gap-6">
      {!resultsMode && (
        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Explore Hayesh</p>
          <h1 className="max-w-3xl font-display text-4xl font-semibold leading-[1.08] tracking-[-0.02em] text-text-primary [text-wrap:balance] sm:text-5xl">
            {name ? (
              <>
                {greeting}, <span className="aurora-text">{name}</span>
              </>
            ) : viewer ? (
              <>
                {greeting}, <span className="aurora-text">welcome back</span>
              </>
            ) : (
              <>
                Learn, hire and create on <span className="aurora-text">Hayesh</span>
              </>
            )}
          </h1>
          <p className="max-w-xl text-base text-text-muted">
            {viewer
              ? "Pick up where you left off, or find your next tutor, freelancer or AI service."
              : "Verified tutors, freelance experts and instant AI services — in one place, protected by escrow."}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            commit()
          }}
          className={cn(
            "flex h-14 w-full items-center gap-3 rounded-lg border border-line-strong bg-surface px-4 transition-[border-color,box-shadow] duration-150",
            "focus-within:border-accent-primary/60 focus-within:shadow-[0_0_24px_rgba(39,196,160,0.18)]",
            !resultsMode && "max-w-3xl",
          )}
        >
          <Search className="h-5 w-5 shrink-0 text-text-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Search tutors, services and AI tools"
            aria-label="Search tutors, services and AI tools"
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent text-base text-text-primary outline-none placeholder:text-text-disabled [&::-webkit-search-cancel-button]:hidden"
          />
          {value ? (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear search"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="hidden h-6 w-6 shrink-0 items-center justify-center rounded border border-line-strong font-mono text-xs text-text-muted sm:flex">
              /
            </kbd>
          )}
        </form>

        {!resultsMode && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">Try</span>
            {SUGGESTIONS.map((s) => (
              <SoftLink
                key={s}
                patch={{ q: s }}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-text-muted transition-colors duration-150 hover:border-line-strong hover:bg-surface-elevated hover:text-text-primary"
              >
                {s}
              </SoftLink>
            ))}
          </div>
        )}
      </div>

      {!resultsMode && (
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {TRUST.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2 text-sm text-text-muted">
              <Icon className="h-4 w-4 text-accent-primary" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
