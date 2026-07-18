"use client"

import { useId, useState } from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils/cn"

export interface RatingStarsProps {
  /** Current rating, 0-5. `null`/`undefined`/`0` renders "No ratings yet" in read-only mode. */
  rating: number | null | undefined
  /** Renders interactive, keyboard-operable star buttons for picking a rating. */
  interactive?: boolean
  /** Called with the new 1-5 value when interactive and the user picks a star. */
  onChange?: (value: number) => void
  size?: "sm" | "md" | "lg"
  className?: string
  /** Optional label prefix for the accessible name, e.g. "Your rating". */
  label?: string
}

const SIZE_CLASSES: Record<NonNullable<RatingStarsProps["size"]>, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
  lg: "h-7 w-7",
}

const STAR_VALUES = [1, 2, 3, 4, 5]

/**
 * Renders 1-5 stars. Two modes:
 *  - read-only (default): displays a static rating, with partial-fill for
 *    decimal averages (e.g. 4.3), or "No ratings yet" when there is no data.
 *  - interactive: a radiogroup of star buttons for picking a 1-5 rating,
 *    operable by click, Arrow keys, and number keys 1-5.
 */
export function RatingStars({
  rating,
  interactive = false,
  onChange,
  size = "md",
  className,
  label,
}: RatingStarsProps) {
  const groupId = useId()
  const [focusedValue, setFocusedValue] = useState<number>(() => {
    const initial = rating && rating > 0 ? Math.round(rating) : 1
    return Math.min(5, Math.max(1, initial))
  })

  if (interactive) {
    const selected = rating && rating > 0 ? Math.round(rating) : 0

    const selectValue = (value: number) => {
      setFocusedValue(value)
      onChange?.(value)
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        event.preventDefault()
        const next = Math.min(5, focusedValue + 1)
        selectValue(next)
      } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        event.preventDefault()
        const next = Math.max(1, focusedValue - 1)
        selectValue(next)
      } else if (/^[1-5]$/.test(event.key)) {
        event.preventDefault()
        selectValue(Number(event.key))
      }
    }

    return (
      <div
        role="radiogroup"
        aria-label={label || "Rating"}
        className={cn("flex items-center gap-1", className)}
        onKeyDown={handleKeyDown}
      >
        {STAR_VALUES.map((value) => {
          const isFilled = value <= (selected || focusedValue)
          const isTabStop = value === (selected || focusedValue)
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={value === selected}
              aria-label={`${value} star${value === 1 ? "" : "s"}`}
              id={`${groupId}-${value}`}
              tabIndex={isTabStop ? 0 : -1}
              onClick={() => selectValue(value)}
              onFocus={() => setFocusedValue(value)}
              className="rounded-md p-0.5 text-accent-warning transition-transform duration-150 hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/50"
            >
              <Star
                className={cn(SIZE_CLASSES[size], isFilled ? "fill-accent-warning text-accent-warning" : "text-text-disabled")}
              />
            </button>
          )
        })}
      </div>
    )
  }

  if (!rating || rating <= 0) {
    return (
      <span className={cn("text-sm text-text-muted", className)} role="img" aria-label="No ratings yet">
        No ratings yet
      </span>
    )
  }

  const clamped = Math.min(5, Math.max(0, rating))

  return (
    <span
      className={cn("relative inline-flex items-center gap-1", className)}
      role="img"
      aria-label={`${clamped.toFixed(1)} out of 5 stars`}
    >
      <span className="flex items-center gap-1" aria-hidden="true">
        {STAR_VALUES.map((value) => (
          <Star key={`bg-${value}`} className={cn(SIZE_CLASSES[size], "text-text-disabled")} />
        ))}
      </span>
      <span
        className="absolute inset-y-0 left-0 flex items-center gap-1 overflow-hidden"
        style={{ width: `${(clamped / 5) * 100}%` }}
        aria-hidden="true"
      >
        {STAR_VALUES.map((value) => (
          <Star key={`fg-${value}`} className={cn(SIZE_CLASSES[size], "shrink-0 fill-accent-warning text-accent-warning")} />
        ))}
      </span>
    </span>
  )
}
