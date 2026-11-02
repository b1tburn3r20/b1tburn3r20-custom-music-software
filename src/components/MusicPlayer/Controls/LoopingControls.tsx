import { cycleRepeat } from "@/player/controls"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { Repeat, Repeat1 } from "lucide-react"

const LABELS = { off: "Repeat: off", all: "Repeat: all", one: "Repeat: one" } as const

const LoopingControls = () => {
  const repeat = usePlayerStore((s) => s.queue.repeat)
  return (
    <button
      aria-label={LABELS[repeat]}
      title={LABELS[repeat]}
      aria-pressed={repeat !== "off"}
      onClick={cycleRepeat}
      className="rounded-full flex justify-center items-center p-4 cursor-pointer hover:bg-secondary/50 hover:text-primary"
    >
      {repeat === "one" ? <Repeat1 className="text-primary" /> : <Repeat className={repeat === "all" ? "text-primary" : "text-muted-foreground"} />}
    </button>
  )
}

export default LoopingControls
