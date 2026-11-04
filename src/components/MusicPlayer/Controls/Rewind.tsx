import { IconButton } from "@/components/base/IconButton"
import { prev } from "@/player/controls"
import { SkipBack } from "lucide-react"

const RewindButton = () => <IconButton icon={SkipBack} size="sm" label="Previous (Ctrl+←)" onClick={prev} iconClassName="fill-current" />
export default RewindButton
