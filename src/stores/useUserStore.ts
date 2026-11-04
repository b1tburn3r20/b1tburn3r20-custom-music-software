import { create } from "zustand"
import type { Settings, UserSnapshot } from "@/types/api"

type UserState = UserSnapshot & {
  loaded: boolean
  likedIds: Set<string>
  setSnapshot: (snap: UserSnapshot) => void
}

const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  volume: 50,
  repeat: "all",
  shuffle: false,
  autoplayRadio: true,
  expandOnPlay: false,
  zenMode: true,
  zenTimeout: 3000,
  playerBackground: "artwork",
  visualizer: "cycle",
  visualizerOffsetMs: 0,
  youtubeAuth: { mode: "none", browser: "firefox", profile: "" },
}

/** Mirror of the main-process user store. Never mutated locally; updated from "user:changed". */
export const useUserStore = create<UserState>((set) => ({
  loaded: false,
  playlists: [],
  likes: [],
  likedIds: new Set(),
  recentlyPlayed: [],
  recentlyDownloaded: [],
  downloadedAt: {},
  recentPlaylists: [],
  settings: DEFAULT_SETTINGS,
  notices: [],
  songTags: {},
  legacyUnresolved: [],
  setSnapshot: (snap) => set({ ...snap, loaded: true, likedIds: new Set(snap.likes.map((l) => l.songId)) }),
}))
