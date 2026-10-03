import { Check, Minus } from "lucide-react"
import { formatPKR } from "@/lib/utils/format"
import type { GigTier } from "./gig-data"

function collectFeatures(tiers: GigTier[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const tier of tiers) {
    for (const f of tier.features) {
      const key = f.trim().toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        out.push(f.trim())
      }
    }
  }
  return out
}

const CELL = "px-4 py-3 text-center align-middle"
const ROW_HEAD = "sticky left-0 z-10 bg-surface px-4 py-3 text-left text-sm font-medium text-text-muted"

export function CompareTable({ tiers }: { tiers: GigTier[] }) {
  const features = collectFeatures(tiers)
  const has = (tier: GigTier, feature: string) => tier.features.some((f) => f.trim().toLowerCase() === feature.toLowerCase())

  return (
    <div className="relative overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="sticky left-0 z-10 bg-surface px-4 py-4 text-left font-mono text-xs font-medium uppercase tracking-[0.12em] text-text-muted">
              Package
            </th>
            {tiers.map((t) => (
              <th key={t.key} scope="col" className="px-4 py-4 text-center align-bottom">
                <span className="block font-display text-base font-semibold text-text-primary">{t.label}</span>
                {t.title && <span className="mt-0.5 block text-xs font-normal text-text-muted">{t.title}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          <tr>
            <th scope="row" className={ROW_HEAD}>Price</th>
            {tiers.map((t) => (
              <td key={t.key} className={`${CELL} font-mono text-base font-semibold tabular-nums text-text-primary`}>
                {formatPKR(t.price)}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row" className={ROW_HEAD}>Delivery</th>
            {tiers.map((t) => (
              <td key={t.key} className={`${CELL} tabular-nums text-text-primary`}>
                {t.deliveryDays != null ? `${t.deliveryDays} ${t.deliveryDays === 1 ? "day" : "days"}` : "—"}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row" className={ROW_HEAD}>Revisions</th>
            {tiers.map((t) => (
              <td key={t.key} className={`${CELL} tabular-nums text-text-primary`}>
                {t.revisions == null ? "—" : t.revisions < 0 ? "Unlimited" : t.revisions}
              </td>
            ))}
          </tr>
          {features.map((feature) => (
            <tr key={feature}>
              <th scope="row" className={`${ROW_HEAD} max-w-[16rem] font-normal text-text-primary`}>{feature}</th>
              {tiers.map((t) => (
                <td key={t.key} className={CELL}>
                  {has(t, feature) ? (
                    <>
                      <Check className="mx-auto h-4 w-4 text-accent-primary" aria-hidden="true" />
                      <span className="sr-only">Included</span>
                    </>
                  ) : (
                    <>
                      <Minus className="mx-auto h-4 w-4 text-text-disabled" aria-hidden="true" />
                      <span className="sr-only">Not included</span>
                    </>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
