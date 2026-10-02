"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export interface OrderActionValues {
  text: string
  files: string[]
}

export interface OrderActionModalProps {
  open: boolean
  title: string
  description?: string
  textLabel: string
  textPlaceholder?: string
  minLength?: number
  /** Show an optional "file URLs, one per line" field (max 10). */
  withFiles?: boolean
  submitLabel: string
  destructive?: boolean
  onClose: () => void
  onSubmit: (values: OrderActionValues) => Promise<string | null>
}

const MAX_FILES = 10

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

const FIELD_CLASS =
  "w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"

export function OrderActionModal({
  open,
  title,
  description,
  textLabel,
  textPlaceholder,
  minLength = 10,
  withFiles = false,
  submitLabel,
  destructive = false,
  onClose,
  onSubmit,
}: OrderActionModalProps) {
  const reduced = useReducedMotion()
  const [text, setText] = useState("")
  const [filesText, setFilesText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    setText("")
    setFilesText("")
    setError(null)
    const frame = requestAnimationFrame(() => areaRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, submitting, onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (trimmed.length < minLength) {
      setError(`Please write at least ${minLength} characters.`)
      return
    }
    const files = filesText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
    if (files.length > MAX_FILES) {
      setError(`You can attach at most ${MAX_FILES} files.`)
      return
    }
    const bad = files.find((f) => !isHttpUrl(f))
    if (bad) {
      setError(`Not a valid http(s) URL: ${bad}`)
      return
    }
    setSubmitting(true)
    setError(null)
    const message = await onSubmit({ text: trimmed, files })
    setSubmitting(false)
    if (message) {
      setError(message)
      return
    }
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !submitting && onClose()}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-action-title"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="order-action-title" className="font-display text-lg font-semibold text-text-primary">
                  {title}
                </h2>
                {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
              </div>
              <button
                type="button"
                onClick={() => !submitting && onClose()}
                aria-label="Close"
                className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="order-action-text">{textLabel}</Label>
                <textarea
                  id="order-action-text"
                  ref={areaRef}
                  rows={5}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={textPlaceholder}
                  maxLength={5000}
                  className={FIELD_CLASS}
                />
              </div>

              {withFiles && (
                <div className="space-y-1.5">
                  <Label htmlFor="order-action-files">File links (optional)</Label>
                  <textarea
                    id="order-action-files"
                    rows={3}
                    value={filesText}
                    onChange={(e) => setFilesText(e.target.value)}
                    placeholder={"https://drive.google.com/...\nhttps://..."}
                    className={`${FIELD_CLASS} font-mono text-xs`}
                  />
                  <p className="text-xs text-text-muted">One URL per line, up to {MAX_FILES}.</p>
                </div>
              )}

              {error && (
                <p role="alert" className="text-sm text-accent-danger">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" variant={destructive ? "destructive" : "aurora"} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitLabel}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
