import { useEffect, useSyncExternalStore } from "react"
import { useUserStore } from "@/stores/useUserStore"

export type ThemeId = "dark" | "light" | "midnight" | "sunset"
export const THEMES: { id: ThemeId; label: string; mode: "dark" | "light"; description: string }[] = [
  { id: "dark", label: "Dark", mode: "dark", description: "The original look" },
  { id: "light", label: "Light", mode: "light", description: "Bright and clean" },
  { id: "midnight", label: "Midnight", mode: "dark", description: "True black with a blue accent" },
  { id: "sunset", label: "Sunset", mode: "dark", description: "Warm plum and amber" },
]
const STORAGE_KEY = "b1t:theme" // mirror for a flash-free first paint (see index.html)

const listeners = new Set<() => void>()
export const themeOf = (id: string | undefined) => THEMES.find((t) => t.id === id) ?? THEMES[0]

export function applyTheme(id: string) {
  const t = themeOf(id)
  const html = document.documentElement
  if (html.dataset.theme === t.id && html.dataset.mode === t.mode) return
  html.dataset.theme = t.id
  html.dataset.mode = t.mode
  try {
    localStorage.setItem(STORAGE_KEY, t.id)
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
    () => (document.documentElement.dataset.mode === "light" ? "light" : "dark"),
  )
}

/** Keeps <html data-theme> in sync with the persisted setting. Mount once. */
export function useThemeSync() {
  const theme = useUserStore((s) => s.settings.theme)
  const loaded = useUserStore((s) => s.loaded)
  useEffect(() => {
    if (loaded) applyTheme(theme)
  }, [theme, loaded])
}
