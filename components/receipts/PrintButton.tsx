"use client"

import { Printer } from "lucide-react"

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100 print:hidden"
    >
      <Printer className="h-4 w-4" />
      Print / save as PDF
    </button>
  )
}
