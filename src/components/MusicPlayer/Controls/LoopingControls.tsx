"use client"

import { usePlayerStore } from "@/stores/usePlayerStore"
import { Repeat, Repeat1 } from "lucide-react"
import { updateSettings } from "@/lib/actions"


const LoopingControls = () => {
  const loopingState = usePlayerStore((f) => f.looping)
  const setLoopingState = usePlayerStore((f) => f.setLooping)





  const handleClick = (val: string) => {
    setLoopingState(val)
    void updateSettings({ repeat: val === "loopPlaylist" ? "all" : val === "loopSong" ? "one" : "off" })

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
