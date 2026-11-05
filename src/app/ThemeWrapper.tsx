import { useEffect } from "react"
import { useUserStore } from "@/stores/useUserStore"
import { applyTheme } from "./theme"

/** Keeps the page on the saved theme. To add a theme, save tweakcn's CSS as src/themes/<name>.css. */
export function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const theme = useUserStore((s) => s.settings.theme)
  const loaded = useUserStore((s) => s.loaded)
  useEffect(() => {
    if (loaded) applyTheme(theme)
  }, [theme, loaded])
  return children
}
