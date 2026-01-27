"use client"

import { usePlayerStore } from "@/stores/usePlayerStore"
import { Slider } from "@/components/ui/slider"
import { Volume, Volume1, Volume2, VolumeX } from "lucide-react"
import { useEffect, useState } from "react"

const MusicVolume = () => {
  const volume = usePlayerStore((f) => f.musicVolume)
  const setMusicVolume = usePlayerStore((f) => f.setMusicVolume)
  const [hovered, setHovered] = useState(false)

  const loadVolumeFromLocalStorage = () => {
    const localStorageVolume = localStorage.getItem("musicVolume")
    if (localStorageVolume) {
      setMusicVolume(Number(localStorageVolume))
    }
  }

  useEffect(() => {
    loadVolumeFromLocalStorage()
  }, [])
  const handleMusicChange = (val: number) => {
    localStorage.setItem("musicVolume", String(val))
    setMusicVolume(val)
  }


  const RenderVolumeButton = () => {
    if (volume < 1) {
      return <VolumeX className="w-5 h-5" />
    } else if (volume < 20) {
      return <Volume className="w-5 h-5" />
    } else if (volume < 70) {
      return <Volume1 className="w-5 h-5" />
    } else {
      return <Volume2 className="w-5 h-5" />
    }
  }

  return (
    <div className="flex items-center gap-3 w-full" onMouseOver={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <RenderVolumeButton />
      <Slider
        value={[volume]}
        onValueChange={(value) => handleMusicChange(value[0])}
        max={100}
        step={1}
        expand={hovered}
        className="w-full"
      />
    </div>
  )
}

export default MusicVolume
