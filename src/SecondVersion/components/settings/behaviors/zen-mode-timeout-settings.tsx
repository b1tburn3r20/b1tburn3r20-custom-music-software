import { Label } from "@/components/ui/label"
import NumberInput from "@/components/ui/number-input"
import { Slider } from "@/components/ui/slider"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { CircleQuestionMark } from "lucide-react"
const ZenModeTimeoutSettings = () => {

  const enabled = useSettingsStore((f) => f.laxPlayerAutoHide)
  const zenModeTimeout = useSettingsStore((f) => f.zenModeTimeout)
  const setZenModeTimeout = useSettingsStore((f) => f.setZenModeTimeout)

  const handleSlide = (number: number) => {
    const LS_KEY = "userSettingZenModeTimout"
    setZenModeTimeout(number)
    localStorage.setItem(LS_KEY, number.toString())
  }



  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">

        <Label>Zen Mode Timeout</Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <CircleQuestionMark size={15} className="text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[300px]">
              This in milliseconds determines how long from when you stop moving your mouse to trigger zen mode.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Slider
        value={[zenModeTimeout]}
        onValueChange={(value) => handleSlide(value[0])}
        max={30000}
        min={500}
        step={500}
        disabled={!enabled}
        className="w-full"
      />
      <span className="text-xs text-muted-foreground">{enabled ? (
        <div className="flex gap-1 items-center">
          <NumberInput max={30} min={.5} className="max-w-[28px] focus-visible:ring-transparent md:text-xs h-auto dark:bg-transparent text-xs p-0 border-none text-muted-foreground bg-transparent" decimal maxDecimalPlaces={1} defaultValue={(zenModeTimeout / 1000).toString()} onChange={(e) => handleSlide(Number(e) * 1000)} />

          <span>
            seconds
          </span>
        </div>
      ) : "Disabled"} </span>
    </div>
  )
}

export default ZenModeTimeoutSettings
