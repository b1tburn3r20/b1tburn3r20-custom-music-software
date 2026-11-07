import { SlidersVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { dialogs } from "@/stores/useDialogStore"
import { useUserStore } from "@/stores/useUserStore"

export default function EqualizerButton() {
  const on = useUserStore((s) => Boolean(s.settings.equalizer?.enabled))
  return (
    <Button size="icon" variant="ghost" aria-label="Equalizer (E)" aria-pressed={on} title={`Equalizer (E)${on ? ": on" : ""}`} onClick={() => dialogs().openEqualizer(true)} className={cn(on && "text-primary hover:text-primary")}>
      <SlidersVertical />
    </Button>
  )
}
