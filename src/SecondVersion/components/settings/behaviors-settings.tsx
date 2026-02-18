import { Label } from "@/components/ui/label"
import ExpandOnPlaySetting from "./behaviors/expand-on-play"
import ZenModeSettings from "./behaviors/zen-mode-settings"
import ZenModeTimeoutSettings from "./behaviors/zen-mode-timeout-settings"

const BehaviorsSettings = () => {
  return (
    <div className="flex flex-col gap-4">
      <Label>App Behavior Settings</Label>
      <div className="flex flex-wrap gap-4 bg-black/50 rounded-xl p-4">
        <ZenModeSettings />
        <ZenModeTimeoutSettings />
      </div>
      <ExpandOnPlaySetting />
    </div>
  )
}

export default BehaviorsSettings
