import { IconButton } from "@/components/base/IconButton"
import { next } from "@/player/controls"
import { SkipForward } from "lucide-react"

const FastForwardButton = () => <IconButton icon={SkipForward} size="sm" label="Next (Ctrl+→)" onClick={next} iconClassName="fill-current" />
export default FastForwardButton
