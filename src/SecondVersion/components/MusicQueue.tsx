import { ScrollArea } from "@/components/ui/scroll-area"
import { usePlayerStore } from "@/stores/usePlayerStore"
import { useLibraryStore } from "@/stores/useLibraryStore"
import MusicQueueItem from "./music-queue-item"
import { useMemo } from "react"

const CONTEXT_LABEL: Record<string, string> = {
  playlist: "Playlist",
  album: "Album",
  artist: "Artist",
  liked: "Liked Songs",
  search: "Search",
  radio: "Radio",
  history: "History",
  downloads: "Downloads",
  list: "Queue",
}

/** The queue in playback order: played songs (dimmed), the current song, then upcoming. */
const MusicQueue = () => {
  const queue = usePlayerStore((s) => s.queue)
  const currentUid = usePlayerStore((s) => s.currentUid)
  const paused = usePlayerStore((s) => s.paused)
  const songsById = useLibraryStore((s) => s.songsById)

  const rows = useMemo(
    () =>
      queue.order
        .map((idx, pos) => ({ item: queue.items[idx], pos }))
        .filter((r) => songsById[r.item.songId])
        .map((r) => ({ ...r, song: songsById[r.item.songId] })),
    [queue, songsById],
  )

  if (!rows.length) return null
  const ctx = queue.context
  return (
    <div className="w-full flex justify-end">
      <div className="flex justify-end bg-black/60 backdrop-blur-lg max-w-md 2xl:max-w-lg h-full flex-col rounded-bl-lg">
        <div className="select-none text-xl flex gap-2 items-baseline font-bold p-4 pb-0 text-muted-foreground min-w-0">
          <span className="truncate">{ctx?.label ?? "Queue"}</span>
          <span className="text-sm font-medium shrink-0">{CONTEXT_LABEL[ctx?.type ?? "list"]}</span>
        </div>
        <ScrollArea className="px-4 pt-4 h-[85vh] min-h-0">
          {rows.map(({ item, song, pos }) => (
            <MusicQueueItem
              key={item.uid}
              uid={item.uid}
              song={song}
              isCurrent={item.uid === currentUid}
              isPlayed={pos < queue.pos}
              isPaused={paused}
              showSeparator={pos === queue.pos}
              addedByUser={item.source === "user"}
            />
          ))}
        </ScrollArea>
      </div>
    </div>
  )
}

export default MusicQueue
