import { IconButton } from "@/components/base/IconButton"
import { cycleRepeat } from "@/player/controls"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { Repeat, Repeat1 } from "lucide-react"

const LABELS = { off: "Repeat: off", all: "Repeat: all", one: "Repeat: one" } as const

const LoopingControls = () => {
  const repeat = usePlayerStore((s) => s.queue.repeat)
  return <IconButton icon={repeat === "one" ? Repeat1 : Repeat} label={LABELS[repeat]} aria-pressed={repeat !== "off"} active={repeat !== "off"} onClick={cycleRepeat} />
}
export default LoopingControls
