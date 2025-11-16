"use client"

import { usePlayerStore } from "@/stores/usePlayerStore"
import { Repeat, Repeat1 } from "lucide-react"


const LoopingControls = () => {
  const loopingState = usePlayerStore((f) => f.looping)
  const setLoopingState = usePlayerStore((f) => f.setLooping)



  if (loopingState === "off") {
    return (
      <button
        onClick={() => setLoopingState("loopPlaylist")}
        className="rounded-full flex justify-center items-center p-4 cursor-pointer hover:bg-secondary hover:text-primary"
      >
        <Repeat className="text-muted-foreground" />
      </button>
    )
  }

  if (loopingState === "loopPlaylist") {
    return (
      <button

        onClick={() => setLoopingState("loopSong")}
        className=" rounded-full flex justify-center items-center p-4 cursor-pointer hover:bg-secondary/50 hover:text-primary"
      >
        <Repeat className="text-primary" />
      </button>
    )
  }


  return (
    <button
      onClick={() => setLoopingState("off")}
      className="rounded-full flex justify-center items-center p-4 cursor-pointer hover:bg-secondary hover:text-primary"
    >
      <Repeat1 className="text-primary" />
    </button>


  )
}

export default LoopingControls
