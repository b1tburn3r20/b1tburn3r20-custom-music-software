import { IconButton } from "@/components/base/IconButton"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

const ToggleExpandPlayer = () => {
  const expanded = useSettingsStore((f) => f.playerExpanded)
  const setExpanded = useSettingsStore((f) => f.setPlayerExpanded)
  return (
    <IconButton
      icon={ChevronUp}
      size="sm"
      label={expanded ? "Collapse player (F)" : "Expand player (F)"}
      aria-expanded={expanded}
      onClick={() => setExpanded(!expanded)}
      iconClassName={cn("transition-transform duration-normal", expanded && "rotate-180")}
    />
  )
}
export default ToggleExpandPlayer
