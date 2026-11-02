import { next } from "@/player/controls"
import { SkipForward } from "lucide-react"

const FastForwardButton = () => (
  <button
    aria-label="Next"
    title="Next"
    onClick={next}
    className="rounded-full flex justify-center items-center p-4 cursor-pointer hover:bg-secondary/50 hover:text-primary"
  >
    <SkipForward />
  </button>
)

export default FastForwardButton
