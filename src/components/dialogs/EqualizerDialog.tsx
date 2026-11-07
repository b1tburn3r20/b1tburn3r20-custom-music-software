import { useEffect, useState } from "react"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/base/Modal"
import { updateSettings } from "@/lib/actions"
import { debounce } from "@/lib/debounce"
import { bandLabel, cleanGains, EQ_BANDS, EQ_FLAT, EQ_MAX_DB, EQ_PRESETS, matchingPreset } from "@/lib/equalizer"
import { cn } from "@/lib/utils"
import { previewEqualizer } from "@/player/analyser"
import { dialogs, useDialogStore } from "@/stores/useDialogStore"
import { useUserStore } from "@/stores/useUserStore"

const save = debounce((gains: number[]) => void updateSettings({ equalizer: { enabled: true, gains } }), 300)
const showDb = (db: number) => `${db > 0 ? "+" : ""}${db}`

/** Changes are heard straight away while the music keeps playing. Choosing or adjusting anything turns it on. */
export default function EqualizerDialog() {
  const open = useDialogStore((s) => s.equalizerOpen)
  const saved = useUserStore((s) => s.settings.equalizer)
  const [gains, setGains] = useState<number[]>(() => cleanGains(saved?.gains))
  const enabled = Boolean(saved?.enabled)
  const active = matchingPreset(gains)

  useEffect(() => {
    if (open) setGains(cleanGains(useUserStore.getState().settings.equalizer?.gains))
  }, [open])

  const choose = (next: number[]) => {
    setGains(next)
    previewEqualizer(next)
    void updateSettings({ equalizer: { enabled: true, gains: next } })
  }
  const adjust = (band: number, db: number) => {
    const next = gains.map((g, i) => (i === band ? db : g))
    setGains(next)
    previewEqualizer(next)
    save(next)
  }

  return (
    <Modal
      open={open}
      onClose={() => dialogs().openEqualizer(false)}
      title="Equalizer"
      description="Shape the sound of everything you play. It never changes your music files."
      footer={
        <Button variant="outline" onClick={() => dialogs().openEqualizer(false)}>
          Done
        </Button>
      }
    >
      <div className="flex h-full min-h-96 flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Switch id="eq-on" checked={enabled} onCheckedChange={(on) => void updateSettings({ equalizer: { enabled: on, gains } })} />
            <Label htmlFor="eq-on">{enabled ? "On" : "Off"}</Label>
          </div>
          <Button variant="ghost" size="sm" disabled={active === "flat"} onClick={() => choose(EQ_FLAT)}>
            <RotateCcw /> Reset
          </Button>
        </div>

        <div role="group" aria-label="Presets" className="flex flex-wrap gap-2">
          {EQ_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={enabled && active === p.id}
              onClick={() => choose(p.gains)}
              className={cn("rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:border-primary hover:text-foreground", enabled && active === p.id && "border-primary bg-primary text-primary-foreground hover:text-primary-foreground")}
            >
              {p.label}
            </button>
          ))}
          {!active && <span className="rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground">Custom</span>}
        </div>

        <div className={cn("grid min-h-64 flex-1 grid-cols-10 gap-1 transition-opacity", !enabled && "opacity-50")}>
          {EQ_BANDS.map((hz, i) => (
            <div key={hz} className="flex min-h-0 flex-col items-center gap-2">
              <span className="text-xs tabular-nums text-muted-foreground">{showDb(gains[i])}</span>
              <Slider orientation="vertical" className="min-h-0 flex-1" aria-label={`${bandLabel(hz)} hertz`} min={-EQ_MAX_DB} max={EQ_MAX_DB} step={1} value={[gains[i]]} onValueChange={(v) => adjust(i, v[0])} />
              <span className="text-xs font-medium">{bandLabel(hz)}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}
