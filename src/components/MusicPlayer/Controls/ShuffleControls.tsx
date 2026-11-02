import { toggleShuffle } from "@/player/controls"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { Shuffle } from "lucide-react"

const ShuffleControls = () => {
  const shuffle = usePlayerStore((s) => s.queue.shuffle)
  return (
    <button
      aria-label={shuffle ? "Shuffle: on" : "Shuffle: off"}
      title={shuffle ? "Shuffle: on" : "Shuffle: off"}
      aria-pressed={shuffle}
      onClick={toggleShuffle}
      className="rounded-full flex justify-center items-center p-4 cursor-pointer hover:bg-secondary/50 hover:text-primary"
    >
      <Shuffle className={shuffle ? "text-primary" : "text-muted-foreground"} />
    </button>
  )
}

export default ShuffleControls
