import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from './components/ui/theme-provider.tsx'
import { bootstrapData } from './data/bootstrap.ts'
import { initPlayer } from './player/controls.ts'
import { installNavigationShortcuts } from './stores/useAppStore.ts'

installNavigationShortcuts()
initPlayer()
void bootstrapData()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <App />
      <Toaster />
    </ThemeProvider>
  </StrictMode>,
)

if (import.meta.env.DEV) {
  // Dev-only handle for debugging from DevTools; tree-shaken out of production builds.
  void Promise.all([import("./stores/useLibraryStore"), import("./stores/useUserStore"), import("./stores/usePlayerStore"), import("./stores/useAppStore")]).then(
    ([l, u, p, a]) => {
      ;(window as unknown as Record<string, unknown>).__b1t = { library: l.useLibraryStore, user: u.useUserStore, player: p.usePlayerStore, app: a.useAppStore }
    },
  )
}
