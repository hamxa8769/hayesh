"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils/cn"

interface JarvisTerminalProps {
  lines: string[]
  className?: string
  speed?: number
  lineDelay?: number
}

export function JarvisTerminal({ lines, className, speed = 25, lineDelay = 400 }: JarvisTerminalProps) {
  const [currentLine, setCurrentLine] = useState(0)
  const [currentChar, setCurrentChar] = useState(0)
  const [displayedLines, setDisplayedLines] = useState<string[]>([])
  const [done, setDone] = useState(false)

  const typeLine = useCallback(() => {
    if (currentLine >= lines.length) {
      setDone(true)
      return
    }

    const line = lines[currentLine]
    if (currentChar < line.length) {
      const timeout = setTimeout(() => {
        setDisplayedLines((prev) => {
          const newLines = [...prev]
          newLines[currentLine] = line.slice(0, currentChar + 1)
          return newLines
        })
        setCurrentChar((c) => c + 1)
      }, speed)
      return () => clearTimeout(timeout)
    } else {
      const timeout = setTimeout(() => {
        setCurrentLine((l) => l + 1)
        setCurrentChar(0)
      }, lineDelay)
      return () => clearTimeout(timeout)
    }
  }, [currentLine, currentChar, lines, speed, lineDelay])

  useEffect(() => {
    const cleanup = typeLine()
    return cleanup
  }, [typeLine])

  return (
    <div className={cn("font-mono text-xs space-y-1", className)}>
      <AnimatePresence>
        {displayedLines.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex gap-2"
          >
            <span className="text-accent-primary select-none">&gt;</span>
            <span className={cn(
              i === currentLine && !done ? "text-accent-secondary" : "text-text-muted"
            )}>
              {line}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
      {!done && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
          className="inline-block text-accent-primary"
        >
          _
        </motion.span>
      )}
    </div>
  )
}
