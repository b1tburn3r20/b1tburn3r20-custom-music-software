import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Card } from "@/components/base/Layout"
import { updateSettings } from "@/lib/actions"
import { debounce } from "@/lib/debounce"
import { useUserStore } from "@/stores/useUserStore"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { SettingRow } from "./SettingRow"

const persistZen = debounce((zenTimeout: number) => void updateSettings({ zenTimeout }), 400)

export default function PlaybackSettings() {
  const settings = useUserStore((s) => s.settings)
  const zenTimeout = useSettingsStore((s) => s.zenModeTimeout)
  return (
    <div className="flex flex-col gap-4">
      <Card className="divide-y divide-border/60 py-1">
        <SettingRow label="Autoplay similar songs" hint="When the queue ends, keep playing songs similar to the last one.">
          {(id) => <Switch id={id} checked={settings.autoplayRadio} onCheckedChange={(v) => void updateSettings({ autoplayRadio: v })} />}
        </SettingRow>
        <SettingRow label="Expand player on play" hint="Open the full-screen player when you start a song or list.">
          {(id) => <Switch id={id} checked={settings.expandOnPlay} onCheckedChange={(v) => void updateSettings({ expandOnPlay: v })} />}
        </SettingRow>
      </Card>
      <Card className="divide-y divide-border/60 py-1">
        <SettingRow label="Zen mode" hint="In the full-screen player, hide the queue and controls after the mouse stops moving.">
          {(id) => <Switch id={id} checked={settings.zenMode} onCheckedChange={(v) => void updateSettings({ zenMode: v })} />}
        </SettingRow>
        <SettingRow label={`Hide after ${(zenTimeout / 1000).toFixed(1)} s`}>
          {(id) => (
            <Slider
              id={id}
              aria-label="Zen mode timeout"
              className="w-48"
              disabled={!settings.zenMode}
              min={1000}
              max={15000}
              step={500}
              value={[zenTimeout]}
              onValueChange={(v) => {
                useSettingsStore.getState().setZenModeTimeout(v[0])
                persistZen(v[0])
              }}
            />
          )}
        </SettingRow>
      </Card>
    </div>
  )
}
