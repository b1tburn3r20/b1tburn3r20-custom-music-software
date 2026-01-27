import { useMusicStore } from "@/stores/useMusicStore";
import type { Song } from "@/types/DirectoryTypes";

export function shuffleArray(array: any[]) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const localStorageRemoveSong = (song: any) => {
  const LS_KEY_RECENT = "recentlyPlayed"
  const ar = localStorage.getItem(LS_KEY_RECENT)
  if (ar) {
    const pr = JSON.parse(ar)
    const na = pr.filter((s: any) => s.path !== song.path)
    localStorage.setItem(LS_KEY_RECENT, JSON.stringify(na))
  }

  // downloaded
  const LS_KEY_DOWN = "userRecentlyDownloaded"
  const ard = localStorage.getItem(LS_KEY_DOWN)
  if (ard) {
    const pr = JSON.parse(ard)
    const na = pr.filter((s: any) => s.path !== song.path)
    localStorage.setItem(LS_KEY_DOWN, JSON.stringify(na))
  }
}

export const addRecentlyPlayed = (song: Song) => {
  const recentlyPlayed = useMusicStore.getState().recentlyPlayed
  const setRecentlyPlayed = useMusicStore.getState().setRecentlyPlayed
  const filtered = recentlyPlayed.filter((s) => s.name !== song.name || s.folderPath !== song.folderPath)
  const newRecPlayed = [song, ...filtered]
  setRecentlyPlayed(newRecPlayed)
  localStorage.setItem("recentlyPlayed", JSON.stringify(newRecPlayed))
}

