import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { CircleQuestionMark } from "lucide-react"
const ExpandOnPlaySetting = () => {
  const expandOnPlay = useSettingsStore((f) => f.expandOnPlay)
  const setExpandOnPlay = useSettingsStore((f) => f.setExpandOnPlay)
  const handleClick = () => {
    const LS_KEY = "userSettingExpandOnPlayToggle"
    const newVal = !expandOnPlay
    setExpandOnPlay(newVal)
    localStorage.setItem(LS_KEY, newVal.toString())
  }


  return (
    <div className="flex flex-col gap-2 w-fit  bg-black/50 rounded-xl p-4 " onClick={() => handleClick()}>
      <div className="flex items-center gap-2">
        <Label>Expand on play</Label>
        <TooltipProvider>
          <Tooltip>

            <TooltipTrigger>
              <CircleQuestionMark size={15} className="text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[300px]">
              When enabled starting a queue / playing a new song will trigger the expanded view.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Switch checked={expandOnPlay} />
    </div>
  )
}

export default ExpandOnPlaySetting
