"use client"

import { Children } from "react"
import type { ReactNode } from "react"
import { motion, useReducedMotion, type Variants } from "framer-motion"

export interface PanelGroupProps {
  title?: string
  children: ReactNode
  className?: string
  staggerDelay?: number
}

const containerVariants: Variants = {
  hidden: {},
  show: (staggerDelay: number) => ({
    transition: { staggerChildren: staggerDelay },
  }),
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
}

export function PanelGroup({ title, children, className, staggerDelay = 0.08 }: PanelGroupProps) {
  const prefersReducedMotion = useReducedMotion()
  const items = Children.toArray(children)

  return (
    <section>
      {title && (
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.12em] text-text-muted">{title}</p>
      )}

      <motion.div
        className={className}
        variants={containerVariants}
        initial={prefersReducedMotion ? false : "hidden"}
        animate="show"
        custom={staggerDelay}
      >
        {items.map((child, index) => (
          <motion.div key={index} variants={itemVariants}>
            {child}
          </motion.div>
        ))}
      </motion.div>
    </section>
  )
}
