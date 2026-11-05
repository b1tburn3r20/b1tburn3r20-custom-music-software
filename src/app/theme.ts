import { useSyncExternalStore } from "react"
import { THEMES } from "virtual:b1t-themes"

export { THEMES }
export type ThemeId = string

const STORAGE_KEY = "b1t:theme" // mirrors for a flash-free first paint (see public/theme-boot.js)
const MODE_KEY = "b1t:theme-mode"

const listeners = new Set<() => void>()
export const themeOf = (id: string | undefined) => THEMES.find((t) => t.id === id) ?? THEMES[0]

/** data-theme picks the colors. The `dark` class is shadcn's convention for dark: styles. */
export function applyTheme(id: string) {
  const t = themeOf(id)
  const html = document.documentElement
  const isDark = t.mode === "dark"
  if (html.dataset.theme === t.id && html.classList.contains("dark") === isDark) return
  html.dataset.theme = t.id
  html.classList.toggle("dark", isDark)
  try {
    localStorage.setItem(STORAGE_KEY, t.id)
    localStorage.setItem(MODE_KEY, t.mode)
  } catch {
    /* storage unavailable: theme still applies for this session */
  }
  listeners.forEach((l) => l())
}

/** Current theme mode, for components that need it in JS (e.g. Sonner). */
export function useThemeMode(): "dark" | "light" {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
  )
}
