"use client"

import { Children, cloneElement, isValidElement, type ReactNode } from "react"
import { useReducedMotion } from "framer-motion"

export interface StaggerProps {
  children: ReactNode
  staggerDelay?: number
  initialDelay?: number
  className?: string
}

function Stagger({ children, staggerDelay = 0.1, initialDelay = 0, className }: StaggerProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <div className={className}>
      {Children.map(children, (child, index) => {
        if (!isValidElement<{ delay?: number }>(child)) return child
        const delay = prefersReducedMotion ? 0 : initialDelay + index * staggerDelay
        return cloneElement(child, { delay })
      })}
    </div>
  )
}

export { Stagger }
