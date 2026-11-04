import { IconButton } from "@/components/base/IconButton"
import { toggleShuffle } from "@/player/controls"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { Shuffle } from "lucide-react"

const ShuffleControls = () => {
  const shuffle = usePlayerStore((s) => s.queue.shuffle)
  return <IconButton icon={Shuffle} size="sm" label={shuffle ? "Shuffle: on (S)" : "Shuffle: off (S)"} aria-pressed={shuffle} active={shuffle} onClick={toggleShuffle} />
}
export default ShuffleControls
