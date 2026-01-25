import { useMusicStore } from "@/stores/useMusicStore"


export const startNewQueue = async (rootDir, path) => {
  console.log("Yep being called")
  const setQueue = useMusicStore.getState().setQueue
  if (!path) {
    console.log("returning")
    return
  }
  try {
    const response: any = await (window as any).electron.getSongQueue({ rootDir, path })
    if (response?.error) {
      throw new Error(response.error)
    }
    console.log("setting", response)
    setQueue(response.songs)
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
    console.log("Heres the new queu", newQueue)
  } catch (error) {
    console.error("This went wrong", error)
  }
}


