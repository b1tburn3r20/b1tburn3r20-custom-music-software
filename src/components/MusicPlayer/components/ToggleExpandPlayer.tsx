"use client"

import { useSettingsStore } from "@/stores/useSettingsStore"
import { Triangle } from "lucide-react"

const ToggleExpandPlayer = () => {
  const playerExpanded = useSettingsStore((f) => f.playerExpanded)
  const setPlayerExpanded = useSettingsStore((f) => f.setPlayerExpanded)

  return (
    <div>
      <button
        id="music-play-button"
        className={`rounded-full flex justify-center items-center p-4 cursor-pointer hover:bg-secondary/50 hover:text-primary transition-all ${!playerExpanded ? "rotate-0" : "rotate-180"}`}
        onClick={() => setPlayerExpanded(!playerExpanded)}
      >
        <Triangle />
      </button>
    </div>
  )
}

export default ToggleExpandPlayer
