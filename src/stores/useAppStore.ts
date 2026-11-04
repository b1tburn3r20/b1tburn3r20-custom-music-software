import { create } from "zustand"

/** Every page in the app. Entities are referenced by id/key, never by a stored copy. */
export type Route =
  | { name: "home" }
  | { name: "search"; q: string }
  | { name: "library"; tab?: "albums" | "artists" | "songs" | "tags" }
  | { name: "playlist"; id: string }
  | { name: "album"; key: string }
  | { name: "artist"; artist: string }
  | { name: "liked" }
  | { name: "tag"; tag: string }
  | { name: "history" }
  | { name: "downloads" }
  | { name: "stats" }
  | { name: "youtube" }

const sameRoute = (a: Route, b: Route) => JSON.stringify(a) === JSON.stringify(b)
const MAX_HISTORY = 50

type AppStore = {
  route: Route
  back: Route[]
  forward: Route[]
  navigate: (route: Route, opts?: { replace?: boolean }) => void
  goBack: () => void
  goForward: () => void
  idle: boolean
  setIdle: (idle: boolean) => void
}

export const useAppStore = create<AppStore>((set, get) => ({
  route: { name: "home" },
  back: [],
  forward: [],
  navigate: (route, { replace = false } = {}) => {
    const { route: cur, back } = get()
    if (sameRoute(cur, route)) return
    if (replace) set({ route })
    else set({ route, back: [...back, cur].slice(-MAX_HISTORY), forward: [] })
  },
  goBack: () => {
    const { back, route, forward } = get()
    if (!back.length) return
    set({ route: back[back.length - 1], back: back.slice(0, -1), forward: [route, ...forward] })
  },
  goForward: () => {
    const { back, route, forward } = get()
    if (!forward.length) return
    set({ route: forward[0], forward: forward.slice(1), back: [...back, route] })
  },
  idle: false,
  setIdle: (idle) => set({ idle }),
}))

export const navigate = (route: Route, opts?: { replace?: boolean }) => useAppStore.getState().navigate(route, opts)

/** Mouse back/forward buttons walk the page history (Alt+←/→ is in src/app/shortcuts.ts). */
export function installNavigationShortcuts() {
  window.addEventListener("mouseup", (e) => {
    if (e.button === 3) useAppStore.getState().goBack()
    if (e.button === 4) useAppStore.getState().goForward()
  })
}
