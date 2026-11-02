import { useState } from "react"
import { create } from "zustand"
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLibraryStore, resolveSongs } from "@/stores/useLibraryStore"
import { useUserStore } from "@/stores/useUserStore"
import { playContext, playRadio } from "@/player/controls"
import { toast } from "sonner"

const FACES = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6]
/** Shared face so the sidebar and home dice roll together. */
const useDice = create<{ song: number; playlist: number; roll: (k: "song" | "playlist") => void }>((set, get) => ({
  song: 5,
  playlist: 3,
  roll: (k) => {
    const others = [0, 1, 2, 3, 4, 5].filter((i) => i !== get()[k])
    set({ [k]: others[Math.floor(Math.random() * others.length)] } as Pick<ReturnType<typeof get>, typeof k>)
  },
}))

/** Roll for a random song radio ("song") or a random playlist ("playlist"). */
export function DiceButton({ kind, size = "large", className }: { kind: "song" | "playlist"; size?: "small" | "large"; className?: string }) {
  const face = useDice((s) => s[kind])
  const roll = useDice((s) => s.roll)
  const [rolling, setRolling] = useState(false)
  const Face = FACES[face] ?? Dice1
  const label = kind === "song" ? "Play a random song radio" : "Play a random playlist"

  const go = () => {
    if (rolling) return
    if (kind === "song") {
      const songs = useLibraryStore.getState().songs
      if (!songs.length) return toast.info("Your library is empty")
      playRadio(songs[Math.floor(Math.random() * songs.length)])
    } else {
      const pls = useUserStore.getState().playlists.filter((p) => p.songIds.length)
      if (!pls.length) return toast.info("No playlists with songs yet")
      const p = pls[Math.floor(Math.random() * pls.length)]
      playContext(resolveSongs(p.songIds), 0, { type: "playlist", id: p.id, label: p.name })
    }
    setRolling(true)
    roll(kind)
    setTimeout(() => setRolling(false), 120)
  }

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={go}
      className={cn(
        "flex aspect-square w-full items-center justify-center bg-radial [--tw-gradient-position:at_top_right] text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
        kind === "song" ? "from-chart-4 via-chart-1 to-chart-5" : "from-chart-5 via-chart-2 to-chart-3",
        size === "small" ? "rounded-lg p-1" : "rounded-3xl p-3",
        className,
      )}
    >
      <Face className={cn("transition-opacity duration-75", rolling && "opacity-20", size === "small" ? "size-9" : "size-3/5")} aria-hidden />
    </button>
  )
}
