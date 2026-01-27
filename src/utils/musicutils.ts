import { useMusicStore } from "@/stores/useMusicStore"
import { usePlayerStore } from "@/stores/usePlayerStore"


export const startNewQueue = async (rootDir, path) => {
  const setQueue = useMusicStore.getState().setQueue
  const setPlayingPlaylist = usePlayerStore.getState().setPlayingPlaylist
  const startPlaying = usePlayerStore.getState().setCurrentlyPlaying
  if (!path) {
    return
  }
  try {
    const response: any = await (window as any).electron.getSongQueue({ rootDir, path })
    if (response?.error) {
      throw new Error(response.error)
    }
    setPlayingPlaylist(null)
    setQueue(response.songs)
    startPlaying(response?.songs[0])
  } catch (error) {
    console.error("This went wrong", error)
  }
}
export const extendQueue = async (rootDir, path, songsToOmit) => {
  const setQueue = useMusicStore.getState().setQueue
  const queue = useMusicStore.getState().queue
  if (!path) {
    return
  }
  try {
    const response: any = await (window as any).electron.getSongQueue({ rootDir, path, songsToOmit })
    if (response?.error) {
      throw new Error(response.error)
    }
    const newQueue = [...queue, ...response.songs]
    setQueue(newQueue)
  } catch (error) {
    console.error("This went wrong", error)
  }
}


