"use client"
import type { FileItem } from "@/stores/useDirectoryStore"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { Music } from "lucide-react"

interface Mp3FileProps {
  file: FileItem
}
const Mp3File = ({ file }: Mp3FileProps) => {
  const currentlyPlaying = usePlayerStore((f) => f.currentlyPlaying)
  const setCurrentlyPlaying = usePlayerStore((f) => f.setCurrentlyPlaying)
  const imPlaying = file?.name === currentlyPlaying?.name

  return (
    <div className="border-l w-full flex gap-4 items-center" onClick={() => setCurrentlyPlaying(file)}>
      <div className="shrink-0 p-2 rounded-xl">
        <Music className="text-primary" />
      </div>
      <div className="flex gap-1">
        <p className="text-lg font-semibold">
          {file.name}
        </p>
        {imPlaying && (
          <div className="animate-pulse">
            <Music />
          </div>
        )}
      </div>
    </div>
  )
}

export default Mp3File
