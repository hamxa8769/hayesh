"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

type ProofMethod = "bank_transfer" | "ibft" | "jazzcash" | "easypaisa"

const METHODS: Array<{ value: ProofMethod; label: string }> = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "ibft", label: "IBFT / Raast" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "easypaisa", label: "Easypaisa" },
]

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
const MAX_BYTES = 5 * 1024 * 1024

const fieldClass =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-line-strong focus:outline-none"

export function ProofUploadForm({ transactionId, userId }: { transactionId: string; userId: string }) {
  const router = useRouter()
  const [method, setMethod] = useState<ProofMethod>("bank_transfer")
  const [reference, setReference] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function onFile(f: File | null) {
    setError(null)
    if (f && !ALLOWED_TYPES.includes(f.type)) {
      setError("Proof must be a JPG, PNG, WebP or PDF file.")
      setFile(null)
      return
    }
    if (f && f.size > MAX_BYTES) {
      setError("File is too large (max 5MB).")
      setFile(null)
      return
    }
    setFile(f)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const ref = reference.trim()
    if (ref.length < 4 || ref.length > 100) {
      setError("Enter the transaction ID from your bank or wallet (4–100 characters).")
      return
    }
    if (!file) {
      setError("Please attach a screenshot or PDF of your payment.")
      return
    }
    setLoading(true)
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80)
      const path = `${userId}/${transactionId}/${Date.now()}-${safeName}`
      const supabase = createClient()
      const { error: upErr } = await supabase.storage
        .from("payment-proofs")
        .upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw new Error(upErr.message)

      const res = await fetch(`/api/checkout/${transactionId}/proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_method: method, payer_reference: ref, proof_path: path }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? "Could not submit your proof. Please try again.")
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="proof-method" className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
          Payment method used
        </label>
        <select
          id="proof-method"
          value={method}
          onChange={(e) => setMethod(e.target.value as ProofMethod)}
          className={fieldClass}
        >
          {METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="proof-ref" className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">
          Transaction ID / TID
        </label>
        <input
          id="proof-ref"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          maxLength={100}
          placeholder="Transaction ID / TID from your bank or wallet"
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">Proof of payment</span>
        <label
          htmlFor="proof-file"
          className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line-strong px-4 py-3 text-sm text-text-muted transition-colors hover:text-text-primary"
        >
          <Upload className="size-4 shrink-0" />
          <span className="min-w-0 truncate">{file ? file.name : "Choose a screenshot or PDF (max 5MB)"}</span>
        </label>
        <input
          id="proof-file"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-accent-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <Button type="submit" variant="aurora" size="lg" disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : <Upload />}
        {loading ? "Submitting…" : "Submit payment proof"}
      </Button>
    </form>
  )
}
