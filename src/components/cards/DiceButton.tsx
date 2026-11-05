import { navigate } from "@/stores/useAppStore"
import { useState } from "react"
import { create } from "zustand"
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { playRadio } from "@/player/controls"
import { toast } from "sonner"

const FACES = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6]
/** Shared face so the sidebar and home dice roll together. */
const useDice = create<{ face: number; roll: () => void }>((set, get) => ({
  face: 5,
  roll: () => {
    const others = [0, 1, 2, 3, 4, 5].filter((i) => i !== get().face)
    set({ face: others[Math.floor(Math.random() * others.length)] })
  },
}))

const LABEL = "Play a random song"

/** Roll for a radio started from a random song. */
export function DiceButton({ size = "large", className }: { size?: "small" | "large"; className?: string }) {
  const face = useDice((s) => s.face)
  const roll = useDice((s) => s.roll)
  const [rolling, setRolling] = useState(false)
  const Face = FACES[face] ?? Dice1

  const go = () => {
    if (rolling) return
    const songs = useLibraryStore.getState().songs
    if (!songs.length) return toast.info("Your library is empty", { description: "Add MP3s to your music folder to play something at random.", action: { label: "Show me", onClick: () => navigate({ name: "home" }) } })
    playRadio(songs[Math.floor(Math.random() * songs.length)])
    setRolling(true)
    roll()
    setTimeout(() => setRolling(false), 120)
  }

  return (
    <button
      type="button"
      title={LABEL}
      aria-label={LABEL}
      onClick={go}
      className={cn(
        "flex aspect-square w-full items-center justify-center bg-radial from-chart-4 via-chart-1 to-chart-5 [--tw-gradient-position:at_top_right] text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
        size === "small" ? "rounded-lg p-1" : "rounded-3xl p-3",
        className,
      )}
    >
      <Face className={cn("transition-opacity duration-75", rolling && "opacity-20", size === "small" ? "size-9" : "size-3/5")} aria-hidden />
    </button>
  )
}
