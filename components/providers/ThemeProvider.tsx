"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export type Theme = "dark" | "light"

const STORAGE_KEY = "hayesh-theme"

interface ThemeContextValue {
  theme: Theme
  /** False until the real theme has been resolved on the client. Consumers
   *  that render theme-dependent markup MUST hold a neutral placeholder
   *  while this is false, or they will cause a hydration mismatch. */
  mounted: boolean
  setTheme: (theme: Theme) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "dark"
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"
}

function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === "dark" || stored === "light" ? stored : null
}

function applyThemeToDocument(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}

/**
 * Provides the current theme (dark/light) and keeps
 * `document.documentElement.dataset.theme` in sync.
 *
 * IMPORTANT — hydration: the initial state is a FIXED "dark" so the server
 * render and the first client render are identical. Previously this state
 * was seeded from localStorage/`prefers-color-scheme`, which the server
 * cannot know: the server always produced "dark" while a light-mode client
 * produced "light", so any theme-dependent markup (e.g. ThemeToggle's icon)
 * mismatched and React threw #418, regenerating the tree and thrashing the
 * WebGL canvas. The real theme is resolved in an effect after mount.
 *
 * There is no flash from this default because the inline no-flash script in
 * app/layout.tsx has already written the true theme to <html data-theme>
 * before first paint, and all colours are driven by that attribute in CSS —
 * not by this React state.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark")
  const [mounted, setMounted] = useState(false)

  // Resolve the real theme after hydration. Prefer what the no-flash script
  // already applied to <html>, so React agrees with the painted UI.
  useEffect(() => {
    const applied = document.documentElement.dataset.theme
    const resolved: Theme =
      applied === "light" || applied === "dark"
        ? applied
        : readStoredTheme() ?? getSystemTheme()

    setThemeState(resolved)
    applyThemeToDocument(resolved)
    setMounted(true)
  }, [])

  // Follow the OS while the user has no explicit preference stored.
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)")
    const handleChange = (event: MediaQueryListEvent) => {
      if (readStoredTheme()) return
      const next: Theme = event.matches ? "light" : "dark"
      setThemeState(next)
      applyThemeToDocument(next)
    }
    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
    applyThemeToDocument(next)
  }, [])

  const toggle = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === "dark" ? "light" : "dark"
      window.localStorage.setItem(STORAGE_KEY, next)
      applyThemeToDocument(next)
      return next
    })
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, mounted, setTheme, toggle }),
    [theme, mounted, setTheme, toggle]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
