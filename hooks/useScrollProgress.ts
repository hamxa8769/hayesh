'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { useScroll } from 'framer-motion'

/**
 * Tracks overall page scroll progress (0 at the top of the document, 1 at
 * the bottom) into a plain ref rather than React state.
 *
 * `ScrollWorld` reads this ref inside a react-three-fiber `useFrame` loop.
 * Per-frame `setState` is forbidden there (it would re-render the whole
 * component tree on every scroll tick and destroy performance), so the
 * scroll position is written into a ref via framer-motion's `.on('change')`
 * subscription instead — no re-render is ever triggered by scrolling.
 */
export function useScrollProgressRef(): RefObject<number> {
  const progressRef = useRef(0)
  const { scrollYProgress } = useScroll()

  useEffect(() => {
    return scrollYProgress.on('change', (value) => {
      progressRef.current = value
    })
  }, [scrollYProgress])

  return progressRef
}
