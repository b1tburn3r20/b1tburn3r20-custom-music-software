import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { playContext, playShuffled, togglePlay } from "@/player/controls"
import type { QueueContext } from "@/player/queue"
import { usePlayerStore } from "@/stores/usePlayerStore"
import type { Song } from "@/types/DirectoryTypes"
import type { LucideIcon } from "lucide-react"
import { Pause, Play, Shuffle, Tags } from "lucide-react"
import { dialogs } from "@/stores/useDialogStore"

const sameContext = (a: QueueContext | null, b: QueueContext) => Boolean(a && a.type === b.type && a.id === b.id && (a.id !== undefined || a.label === b.label))

/** Big round Play / Pause for a list; pauses/resumes if that list is already playing. */
export function PlayAllButton({ songs, context }: { songs: readonly Song[]; context: QueueContext }) {
  const active = usePlayerStore((s) => sameContext(s.queue.context, context))
  const playing = usePlayerStore((s) => !s.paused) && active
  return (
    <Button size="icon-lg" className="size-14 rounded-full" disabled={!songs.length} aria-label={playing ? "Pause" : "Play"} onClick={() => (active ? togglePlay() : playContext(songs, 0, context))}>
      {playing ? <Pause className="size-6 fill-current" /> : <Play className="size-6 fill-current" />}
    </Button>
  )
}

export function ShuffleAllButton({ songs, context }: { songs: readonly Song[]; context: QueueContext }) {
  return (
    <IconAction icon={Shuffle} label="Shuffle play" disabled={!songs.length} onClick={() => playShuffled(songs, context)} />
  )
}

export function IconAction({ icon: Icon, label, onClick, disabled, className }: { icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <Button variant="ghost" size="icon-lg" title={label} aria-label={label} disabled={disabled} onClick={onClick} className={cn("size-12 rounded-full", className)}>
      <Icon className="size-5" />
    </Button>
  )
}

/** Tag every song in a list at once (adds/removes tags without touching others). */
export function TagAllButton({ songs }: { songs: readonly Song[] }) {
  return <IconAction icon={Tags} label={`Tag all ${songs.length} songs`} disabled={!songs.length} onClick={() => dialogs().openTags([...songs])} />
}
