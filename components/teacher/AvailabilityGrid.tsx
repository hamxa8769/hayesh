import { cn } from "@/lib/utils/cn"
import { DAYS, SLOTS } from "@/components/teacher/onboarding-schema"

const DAY_LABELS: Record<(typeof DAYS)[number], string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
}

const SLOT_LABELS: Record<(typeof SLOTS)[number], string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
}

export type AvailabilityValue = Record<string, string[]>

export interface AvailabilityGridProps {
  value: AvailabilityValue
  onChange: (value: AvailabilityValue) => void
  className?: string
}

/**
 * Weekly availability toggle grid. Writes the exact `{ mon: ['morning',...],
 * ... }` shape already used by `teachers.availability` jsonb — this is a
 * pure controlled component so selections persist across wizard steps via
 * the parent react-hook-form state (no local state to lose on unmount).
 */
export function AvailabilityGrid({ value, onChange, className }: AvailabilityGridProps) {
  const toggle = (day: string, slot: string) => {
    const daySlots = value[day] ?? []
    const nextDaySlots = daySlots.includes(slot) ? daySlots.filter((s) => s !== slot) : [...daySlots, slot]
    onChange({ ...value, [day]: nextDaySlots })
  }

  const totalSelected = Object.values(value).reduce((sum, slots) => sum + slots.length, 0)

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-separate border-spacing-1.5">
          <thead>
            <tr>
              <th className="w-14 text-left font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted" />
              {SLOTS.map((slot) => (
                <th
                  key={slot}
                  className="px-1 pb-1 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted"
                >
                  {SLOT_LABELS[slot]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day) => (
              <tr key={day}>
                <td className="pr-2 font-mono text-xs uppercase text-text-muted">{DAY_LABELS[day]}</td>
                {SLOTS.map((slot) => {
                  const active = (value[day] ?? []).includes(slot)
                  return (
                    <td key={slot} className="p-0.5">
                      <button
                        type="button"
                        onClick={() => toggle(day, slot)}
                        aria-pressed={active}
                        aria-label={`${DAY_LABELS[day]} ${SLOT_LABELS[slot]}`}
                        className={cn(
                          "h-9 w-full rounded-md border text-xs font-medium transition-all duration-150",
                          active
                            ? "border-accent-primary/50 bg-accent-primary/15 text-accent-primary shadow-[0_0_12px_rgba(39,196,160,0.25)]"
                            : "border-border bg-surface-elevated text-text-muted hover:border-line-strong hover:text-text-primary"
                        )}
                      >
                        {active ? "✓" : ""}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 font-mono text-xs tabular-nums text-text-muted">
        {totalSelected} slot{totalSelected === 1 ? "" : "s"} selected
      </p>
    </div>
  )
}
