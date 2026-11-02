import { IconButton } from "@/components/base/IconButton"
import { prev } from "@/player/controls"
import { SkipBack } from "lucide-react"

const RewindButton = () => <IconButton icon={SkipBack} label="Previous" onClick={prev} />
export default RewindButton
