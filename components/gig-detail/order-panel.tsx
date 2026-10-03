"use client"

import { useState } from "react"
import { Check, Clock, RotateCcw, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OrderModal } from "@/components/marketplace/OrderModal"
import { cn } from "@/lib/utils/cn"
import { formatPKR } from "@/lib/utils/format"
import { MessageSellerButton } from "./message-seller-button"
import { pluralize, type GigTier, type TierKey } from "./gig-data"

interface OrderPanelProps {
  gigId: string
  tiers: GigTier[]
}

/**
 * Sticky purchase panel: package tabs, price, features, primary CTA (opens the
 * existing OrderModal) and a pre-order inquiry button. On mobile a fixed bottom
 * bar mirrors the price + CTA so it is always reachable.
 */
export function OrderPanel({ gigId, tiers }: OrderPanelProps) {
  const [selected, setSelected] = useState<TierKey>(() => (tiers.find((t) => t.key === "standard") ?? tiers[0])?.key ?? "basic")
  const [orderOpen, setOrderOpen] = useState(false)

  const tier = tiers.find((t) => t.key === selected) ?? tiers[0]
  if (!tier) return null

  const cta = `Continue (${formatPKR(tier.price)})`

  return (
    <>
      <div
        className="overflow-hidden rounded-lg border border-line-strong bg-surface shadow-[0_8px_30px_rgba(0,0,0,0.18)]"
        id="order-panel"
      >
        {tiers.length > 1 && (
          <div role="tablist" aria-label="Packages" className="grid border-b border-border" style={{ gridTemplateColumns: `repeat(${tiers.length}, minmax(0, 1fr))` }}>
            {tiers.map((t) => {
              const active = t.key === tier.key
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  id={`tier-tab-${t.key}`}
                  aria-selected={active}
                  aria-controls="tier-panel"
                  onClick={() => setSelected(t.key)}
                  className={cn(
                    "relative px-3 py-3.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-primary/60",
                    active ? "bg-surface-elevated text-text-primary" : "text-text-muted hover:bg-surface-elevated/60 hover:text-text-primary"
                  )}
                >
                  {t.label}
                  {active && <span className="absolute inset-x-0 bottom-[-1px] h-[2px] aurora-bg" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        )}

        <div id="tier-panel" role="tabpanel" aria-labelledby={`tier-tab-${tier.key}`} className="flex flex-col gap-5 p-5">
          <div className="flex items-start justify-between gap-4">
            <h3 className="min-w-0 text-balance font-display text-base font-semibold leading-snug text-text-primary">
              {tier.title || `${tier.label} package`}
            </h3>
            <p className="shrink-0 font-mono text-2xl font-semibold tabular-nums text-text-primary">{formatPKR(tier.price)}</p>
          </div>

          {tier.description && <p className="text-sm leading-relaxed text-text-muted">{tier.description}</p>}

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-primary">
            {tier.deliveryDays != null && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-text-muted" aria-hidden="true" />
                <span className="tabular-nums">{pluralize(tier.deliveryDays, "day")}</span> delivery
              </span>
            )}
            {tier.revisions != null && (
              <span className="inline-flex items-center gap-1.5">
                <RotateCcw className="h-4 w-4 text-text-muted" aria-hidden="true" />
                <span className="tabular-nums">{tier.revisions < 0 ? "Unlimited" : tier.revisions}</span> {tier.revisions === 1 ? "revision" : "revisions"}
              </span>
            )}
          </div>

          {tier.features.length > 0 && (
            <ul className="flex flex-col gap-2 border-t border-border pt-4 text-sm text-text-primary">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-primary" aria-hidden="true" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-2.5">
            <Button type="button" variant="aurora" size="lg" className="w-full tabular-nums" onClick={() => setOrderOpen(true)}>
              {cta}
            </Button>
            <MessageSellerButton gigId={gigId} redirectPath={`/marketplace/${gigId}`} />
            {tiers.length > 1 && (
              <a href="#compare" className="self-center text-xs font-medium text-text-muted underline-offset-4 transition-colors hover:text-text-primary hover:underline">
                Compare packages
              </a>
            )}
          </div>

          <p className="flex items-start gap-2 border-t border-border pt-4 text-xs leading-relaxed text-text-muted">
            <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-accent-success" aria-hidden="true" />
            Payment held in escrow until you approve delivery.
          </p>
        </div>
      </div>

      {/* Mobile sticky CTA bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line-strong bg-background/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">{tier.label}</p>
            <p className="font-mono text-lg font-semibold tabular-nums text-text-primary">{formatPKR(tier.price)}</p>
          </div>
          <Button type="button" variant="aurora" size="lg" className="shrink-0" onClick={() => setOrderOpen(true)}>
            Continue
          </Button>
        </div>
      </div>

      <OrderModal
        open={orderOpen}
        onClose={() => setOrderOpen(false)}
        gigId={gigId}
        tier={{
          key: tier.key,
          label: tier.label,
          title: tier.title,
          price: tier.price,
          deliveryDays: tier.deliveryDays,
          revisions: tier.revisions,
        }}
      />
    </>
  )
}
