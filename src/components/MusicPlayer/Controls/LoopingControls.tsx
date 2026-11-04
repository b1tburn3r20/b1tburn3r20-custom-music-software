import { IconButton } from "@/components/base/IconButton"
import { cycleRepeat } from "@/player/controls"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { Repeat, Repeat1 } from "lucide-react"

const LABELS = { off: "Repeat: off (R)", all: "Repeat: all (R)", one: "Repeat: one (R)" } as const

const LoopingControls = () => {
  const repeat = usePlayerStore((s) => s.queue.repeat)
  return <IconButton icon={repeat === "one" ? Repeat1 : Repeat} size="sm" label={LABELS[repeat]} aria-pressed={repeat !== "off"} active={repeat !== "off"} onClick={cycleRepeat} />
}
export default LoopingControls
