"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import type { PaymentAccounts } from "@/lib/payments/settings"

export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : `Copy ${label}`}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-text-muted transition-colors hover:border-line-strong hover:text-text-primary",
        className
      )}
    >
      {copied ? <Check className="size-4 text-accent-success" /> : <Copy className="size-4" />}
    </button>
  )
}

export function hasPaymentAccounts(a: PaymentAccounts): boolean {
  return Boolean(
    a.bankName || a.accountTitle || a.accountNumber || a.iban || a.jazzcashNumber || a.easypaisaNumber
  )
}

export function PaymentAccountCard({ accounts }: { accounts: PaymentAccounts }) {
  const rows: Array<{ label: string; value: string }> = [
    { label: "Bank", value: accounts.bankName },
    { label: "Account title", value: accounts.accountTitle },
    { label: "Account number", value: accounts.accountNumber },
    { label: "IBAN", value: accounts.iban },
    { label: "JazzCash", value: accounts.jazzcashNumber },
    { label: "Easypaisa", value: accounts.easypaisaNumber },
  ].filter((r) => r.value.trim() !== "")

  return (
    <div className="rounded-lg border border-border bg-background/40">
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">{r.label}</p>
              <p className="break-all font-mono text-sm tabular-nums text-text-primary">{r.value}</p>
            </div>
            <CopyButton value={r.value} label={r.label} />
          </li>
        ))}
      </ul>
      {accounts.instructions.trim() !== "" && (
        <p className="border-t border-border px-4 py-3 text-sm text-text-muted">{accounts.instructions}</p>
      )}
    </div>
  )
}
