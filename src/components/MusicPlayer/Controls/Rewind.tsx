import { prev } from "@/player/controls"
import { SkipBack } from "lucide-react"

const RewindButton = () => (
  <button
    aria-label="Previous (restarts the song if more than 3 seconds in)"
    title="Previous"
    onClick={prev}
    className="rounded-full flex justify-center items-center p-4 cursor-pointer hover:bg-secondary/50 hover:text-primary"
  >
    <SkipBack />
  </button>
)

export default RewindButton
