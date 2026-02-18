import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { CircleQuestionMark } from "lucide-react"
const ZenModeSettings = () => {


  const laxPlayerAutoHide = useSettingsStore((f) => f.laxPlayerAutoHide)
  const setLaxPlayerAutoHide = useSettingsStore((f) => f.setLaxPlayerAutoHide)

  const handleClick = () => {
    const LS_KEY = "userSettingZenModeToggle"
    const newVal = !laxPlayerAutoHide
    setLaxPlayerAutoHide(newVal)
    localStorage.setItem(LS_KEY, newVal.toString())
  }


  return (
    <div className="flex flex-col gap-2 w-fit" onClick={() => handleClick()}>
      <div className="flex items-center gap-2">

        <Label>Zen Mode</Label>
        <TooltipProvider>
          <Tooltip>

            <TooltipTrigger>
              <CircleQuestionMark size={15} className="text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[300px]">
              When enabled this feature will hide the queue and the music player after a set amount of time, causing a zen like experience when the music player is expanded.

            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Switch checked={laxPlayerAutoHide} />
    </div>
  )
}

export default ZenModeSettings
