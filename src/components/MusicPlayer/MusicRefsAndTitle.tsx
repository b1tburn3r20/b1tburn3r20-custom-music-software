import { usePlayerStore } from "@/stores/usePlayerStore"

/** Title of the current song. (Audio is owned by src/player/engine.ts.) */
const MusicRefsAndTitle = () => {
  const title = usePlayerStore((s) => s.currentlyPlaying?.metadata.title)
  if (!title) return null
  return (
    <div title={title} className="select-none truncate">
      {title}
    </div>
  )
}

export default MusicRefsAndTitle
