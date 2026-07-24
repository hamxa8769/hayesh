"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Loader2, Search, UserPlus, X } from "lucide-react"

export interface SelectedUser {
  id: string
  full_name: string | null
  email: string | null
}

interface InviteesApiResponse {
  users?: SelectedUser[]
  error?: string
}

export interface InviteePickerProps {
  value: SelectedUser[]
  onChange: (users: SelectedUser[]) => void
  id?: string
}

const DEBOUNCE_MS = 300

/**
 * Searchable multi-select for GET /api/meetings/invitees. Only teachers,
 * sellers and admins may call that endpoint (403 for everyone else) — this
 * component surfaces that as a small muted message rather than a hard error,
 * since a caller reaching this UI at all implies they're on the host path.
 */
export function InviteePicker({ value, onChange, id }: InviteePickerProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const listboxId = `${inputId}-listbox`
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SelectedUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounced search: fires ~300ms after the user stops typing, aborting any
  // still-in-flight request from a previous keystroke so a slow early
  // response can never clobber a later one.
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    const timer = setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      fetch(`/api/meetings/invitees?q=${encodeURIComponent(trimmed)}&limit=25`, { signal: controller.signal })
        .then(async (res) => {
          const json = (await res.json()) as InviteesApiResponse
          if (!res.ok) {
            setError(res.status === 403 ? "You don't have permission to invite people." : json.error ?? "Search failed")
            setResults([])
            return
          }
          setError(null)
          setResults(json.users ?? [])
        })
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === "AbortError") return
          setError("Search failed. Please try again.")
          setResults([])
        })
        .finally(() => setLoading(false))
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [query])

  // Abort any in-flight search on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const addUser = (user: SelectedUser) => {
    if (value.some((u) => u.id === user.id)) return
    onChange([...value, user])
    setQuery("")
    setResults([])
    setOpen(false)
  }

  const removeUser = (id: string) => {
    onChange(value.filter((u) => u.id !== id))
  }

  const visibleResults = results.filter((u) => !value.some((v) => v.id === u.id))
  const resultsOpen = open && query.trim().length > 0

  return (
    <div ref={containerRef} className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-elevated px-2.5 py-1 text-xs text-text-primary"
            >
              {u.full_name ?? u.email ?? "Invitee"}
              <button
                type="button"
                onClick={() => removeUser(u.id)}
                aria-label={`Remove ${u.full_name ?? "invitee"}`}
                className="text-text-muted transition-colors hover:text-accent-danger"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          id={inputId}
          role="combobox"
          aria-expanded={resultsOpen}
          aria-controls={listboxId}
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search by name or email..."
          className="flex h-10 w-full rounded-lg border border-border bg-surface-elevated py-2 pl-9 pr-9 text-sm text-text-primary placeholder:text-text-muted transition-all duration-300 focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-text-muted" />
        )}

        {resultsOpen && (
          <div
            id={listboxId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-surface-elevated shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
          >
            {error ? (
              <p role="alert" className="p-3 text-xs text-text-muted">
                {error}
              </p>
            ) : !loading && visibleResults.length === 0 ? (
              <p className="p-3 text-xs text-text-muted">No matches found.</p>
            ) : (
              visibleResults.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => addUser(u)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-surface"
                >
                  <UserPlus className="h-3.5 w-3.5 shrink-0 text-accent-primary" />
                  <span className="min-w-0 truncate">
                    {u.full_name ?? "Unnamed"}
                    {u.email && <span className="text-text-muted"> · {u.email}</span>}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
