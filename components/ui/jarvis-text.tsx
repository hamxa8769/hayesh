"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils/cn"

interface JarvisTextProps {
  text: string
  className?: string
  speed?: number
  delay?: number
  cursor?: boolean
  onComplete?: () => void
}

export function JarvisText({
  text,
  className,
  speed = 30,
  delay = 0,
  cursor = true,
  onComplete,
}: JarvisTextProps) {
  const [displayedText, setDisplayedText] = useState("")
  const [started, setStarted] = useState(false)
  const [complete, setComplete] = useState(false)

  const typeText = useCallback(() => {
    let index = 0
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1))
        index++
      } else {
        clearInterval(interval)
        setComplete(true)
        onComplete?.()
      }
    }, speed)

    return () => clearInterval(interval)
  }, [text, speed, onComplete])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setStarted(true)
    }, delay)

    return () => clearTimeout(timeout)
  }, [delay])

  useEffect(() => {
    if (!started) return
    return typeText()
  }, [started, typeText])

  return (
    <span className={cn("font-mono", className)}>
      {displayedText}
      {cursor && !complete && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
          className="inline-block ml-0.5 text-accent-primary"
        >
          _
        </motion.span>
      )}
    </span>
  )
}
