import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { dialogs } from "@/stores/useDialogStore"
import { Slider } from "@/components/ui/slider"
import { Card } from "@/components/base/Layout"
import { updateSettings } from "@/lib/actions"
import { debounce } from "@/lib/debounce"
import { useUserStore } from "@/stores/useUserStore"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { SettingRow } from "./SettingRow"
import { SCENES } from "@/components/visualizer/scenes"
import { cn } from "@/lib/utils"

const VISUALIZER_CHOICES: { id: string; label: string; description: string; calm?: boolean }[] = [{ id: "cycle", label: "Mix it up", description: "A different visualization for each song." }, ...SCENES]

const persistZen = debounce((zenTimeout: number) => void updateSettings({ zenTimeout }), 400)
const persistOffset = debounce((visualizerOffsetMs: number) => void updateSettings({ visualizerOffsetMs }), 400)

export default function PlaybackSettings() {
  const settings = useUserStore((s) => s.settings)
  const zenTimeout = useSettingsStore((s) => s.zenModeTimeout)
  const [offset, setOffset] = useState(settings.visualizerOffsetMs || 0)
  return (
    <div className="flex flex-col gap-4">
      <Card className="divide-y divide-border/60 py-1">
        <SettingRow label="Equalizer" hint="Shape the sound with presets or your own settings. Press E any time.">
          {(id) => (
            <div className="flex items-center gap-3">
              <Button size="sm" variant="secondary" onClick={() => dialogs().openEqualizer(true)}>
                Adjust
              </Button>
              <Switch id={id} checked={Boolean(settings.equalizer?.enabled)} onCheckedChange={(v) => void updateSettings({ equalizer: { ...settings.equalizer, enabled: v } })} />
            </div>
          )}
        </SettingRow>
        <SettingRow label="Autoplay similar songs" hint="When the queue ends, keep playing songs similar to the last one.">
          {(id) => <Switch id={id} checked={settings.autoplayRadio} onCheckedChange={(v) => void updateSettings({ autoplayRadio: v })} />}
        </SettingRow>
        <SettingRow label="Expand player on play" hint="Open the full-screen player when you start a song or list.">
          {(id) => <Switch id={id} checked={settings.expandOnPlay} onCheckedChange={(v) => void updateSettings({ expandOnPlay: v })} />}
        </SettingRow>
      </Card>
      <Card className="divide-y divide-border/60 py-1">
        <SettingRow label="Visualizer background" hint="In the full-screen player, replace the blurred cover with visuals that move to the music. Press B there to switch, V for the next visualization.">
          {(id) => <Switch id={id} checked={settings.playerBackground === "visualizer"} onCheckedChange={(v) => void updateSettings({ playerBackground: v ? "visualizer" : "artwork" })} />}
        </SettingRow>
        <div role="radiogroup" aria-label="Visualization" className="grid grid-cols-2 gap-2 py-3">
          {VISUALIZER_CHOICES.map((c) => {
            const current = SCENES.some((x) => x.id === settings.visualizer) ? settings.visualizer : "cycle" // removed scenes count as "Mix it up"
            const selected = current === c.id
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={settings.playerBackground !== "visualizer"}
                onClick={() => void updateSettings({ visualizer: c.id })}
                className={cn("rounded-lg border-2 p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50", selected ? "border-primary" : "border-border hover:border-muted-foreground")}
              >
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {c.label}
                  {c.calm && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Calm</span>}
                </p>
                <p className="text-xs text-muted-foreground">{c.description}</p>
              </button>
            )
          })}
        </div>
        <SettingRow label={`Visualizer timing: ${offset > 0 ? "+" : ""}${offset} ms`} hint="Audio output delay is compensated automatically. If pulses still land early (common with Bluetooth headphones), add delay here.">
          {(id) => (
            <Slider
              id={id}
              aria-label="Visualizer timing"
              className="w-48"
              disabled={settings.playerBackground !== "visualizer"}
              min={-100}
              max={400}
              step={10}
              value={[offset]}
              onValueChange={(v) => {
                setOffset(v[0])
                persistOffset(v[0])
              }}
            />
          )}
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
