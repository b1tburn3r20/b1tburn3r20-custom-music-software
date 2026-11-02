import { IconButton } from "@/components/base/IconButton"
import { next } from "@/player/controls"
import { SkipForward } from "lucide-react"

const FastForwardButton = () => <IconButton icon={SkipForward} label="Next" onClick={next} />
export default FastForwardButton
