import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { SongRow } from "@/components/song/SongRow"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { jumpTo, togglePlay } from "@/player/controls"
import { Fragment, useMemo } from "react"

const CONTEXT_LABEL: Record<string, string> = {
  playlist: "Playlist", album: "Album", artist: "Artist", liked: "Liked Songs", search: "Search", radio: "Radio", history: "History", downloads: "Downloads", list: "Queue",
}

/** The queue in playback order: played songs (dimmed), the current song, then upcoming. */
const MusicQueue = () => {
  const queue = usePlayerStore((s) => s.queue)
  const currentUid = usePlayerStore((s) => s.currentUid)
  const songsById = useLibraryStore((s) => s.songsById)
  const collapse = () => useSettingsStore.getState().setPlayerExpanded(false)

  const rows = useMemo(
    () => queue.order.map((idx, pos) => ({ item: queue.items[idx], pos, song: songsById[queue.items[idx].songId] })).filter((r) => r.song),
    [queue, songsById],
  )
  if (!rows.length) return null
  const ctx = queue.context
  return (
    <div className="w-full flex justify-end">
      <div className="flex h-full max-w-md 2xl:max-w-lg flex-col rounded-bl-lg bg-background/60 backdrop-blur-lg">
        <div className="flex min-w-0 select-none items-baseline gap-2 p-4 pb-0 text-xl font-bold text-muted-foreground">
          <span className="truncate">{ctx?.label ?? "Queue"}</span>
          <span className="shrink-0 text-sm font-medium">{CONTEXT_LABEL[ctx?.type ?? "list"]}</span>
        </div>
        <ScrollArea className="h-[85vh] min-h-0 px-4 pt-4">
          <div className="md:min-w-[400px]">
            {rows.map(({ item, song, pos }) => (
              <Fragment key={item.uid}>
                <SongRow
                  song={song}
                  variant="compact"
                  queueUid={item.uid}
                  isCurrent={item.uid === currentUid}
                  onActivate={() => (item.uid === currentUid ? togglePlay() : jumpTo(item.uid))}
                  dimmed={pos < queue.pos}
                  badge={item.source === "user" ? "queued" : item.source === "radio" ? "radio" : undefined}
                  onNavigate={collapse}
                />
                {pos === queue.pos && <Separator className="my-2" />}
              </Fragment>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

export default MusicQueue
