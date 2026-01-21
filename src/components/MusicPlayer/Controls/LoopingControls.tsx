"use client"

import { usePlayerStore } from "@/stores/usePlayerStore"
import { Repeat, Repeat1 } from "lucide-react"
import { useEffect } from "react"


const LoopingControls = () => {
  const loopingState = usePlayerStore((f) => f.looping)
  const setLoopingState = usePlayerStore((f) => f.setLooping)

  const LOCAL_STORAGE_VAL = "userLoopingPreferance"

  const loadFromLocalStorage = () => {
    const val = localStorage.getItem(LOCAL_STORAGE_VAL)
    if (val) {

      setLoopingState(val)
    }
  }
  useEffect(() => {
    loadFromLocalStorage()
  }, [])

  const handleClick = (val: string) => {
    setLoopingState(val)
    localStorage.setItem(LOCAL_STORAGE_VAL, val)

  }

  if (loopingState === "off") {
    return (
      <button
        onClick={() => handleClick("loopPlaylist")}
        className="rounded-full flex justify-center items-center p-4 cursor-pointer hover:bg-secondary hover:text-primary"
      >
        <Repeat className="text-muted-foreground" />
      </button>
    )
  }

  if (loopingState === "loopPlaylist") {
    return (
      <button

        onClick={() => handleClick("loopSong")}
        className=" rounded-full flex justify-center items-center p-4 cursor-pointer hover:bg-secondary/50 hover:text-primary"
      >
        <Repeat className="text-primary" />
      </button>
    )
  }


  return (
    <button
      onClick={() => handleClick("off")}
      className="rounded-full flex justify-center items-center p-4 cursor-pointer hover:bg-secondary/50 hover:text-primary"
    >
      <Repeat1 className="text-primary" />
    </button>


  )
}

export default LoopingControls
