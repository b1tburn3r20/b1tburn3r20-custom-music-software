import { useMemo, useState } from "react"
import { Check, Plus, Sparkles, Tags, X } from "lucide-react"
import { openSettings } from "@/app/settings/settingsStore"
import { HomeSection } from "@/components/home/HomeSection"
import { useColumns } from "@/hooks/useColumns"
import { SongRow } from "@/components/song/SongRow"
import { Button } from "@/components/ui/button"
import { setSongTag } from "@/lib/actions"
import { songsToTag, suggestTags } from "@/lib/homeFeed"
import { cn } from "@/lib/utils"
import { dialogs } from "@/stores/useDialogStore"
import { useLibraryStore } from "@/stores/useLibraryStore"
import { useStatsStore } from "@/stores/useStatsStore"
import { useUserStore } from "@/stores/useUserStore"
import type { QueueContext } from "@/player/queue"
import type { Song } from "@/types/DirectoryTypes"

const CONTEXT: QueueContext = { type: "list", id: "songs-to-tag", label: "Songs to tag" }
/** Skipped for this session, so coming back home doesn't ask about the same songs again. */
const skipped = new Set<string>()

function TagRow({ song, reason, list, index, onSkip }: { song: Song; reason: string; list: Song[]; index: number; onSkip: () => void }) {
  const own = useUserStore((s) => s.songTags[song.id])
  const has = (t: string) => own?.some((x) => x.toLowerCase() === t.toLowerCase()) ?? false
  // Picked once: chips must not jump around while you click them.
  const [suggested] = useState(() => suggestTags(song, useLibraryStore.getState().songs, useUserStore.getState().songTags))
  const extra = (own ?? []).filter((t) => !suggested.some((x) => x.toLowerCase() === t.toLowerCase()))
  return (
    <div className="min-w-0 pb-2">
      <SongRow song={song} variant="compact" startRadio list={list} index={index} queueContext={CONTEXT} badge={reason || undefined} />
      <div className="flex flex-wrap items-center gap-1 pl-16 pr-3">
        {[...suggested, ...extra].map((t) => {
          const on = has(t)
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              title={on ? `Remove “${t}”` : `Tag “${t}”`}
              onClick={() => void setSongTag(song.id, t, !on)}
              className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", on ? "border-primary bg-primary/20 text-foreground" : "border-border text-muted-foreground hover:border-primary hover:text-foreground")}
            >
              {on ? <Check className="size-3" aria-hidden /> : <Plus className="size-3" aria-hidden />}
              {t}
            </button>
          )
        })}
        <button type="button" onClick={() => dialogs().openTags([song])} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          <Tags className="size-3" aria-hidden /> {suggested.length ? "Other…" : "Add tags…"}
        </button>
        <button type="button" aria-label={`Skip ${song.metadata.title}`} title="Skip for now" onClick={onSkip} className="ml-auto rounded-full p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          <X className="size-3" aria-hidden />
        </button>
      </div>
    </div>
  )
}

/**
 * Keeps tagging from falling behind: a few untagged songs at a time, most listened
 * first, with one-click tag ideas. Songs stay put while you tag them (so you can add
 * several tags) and leave on "Next".
 */
export function TagQueue() {
  const songs = useLibraryStore((s) => s.songs)
  const songTags = useUserStore((s) => s.songTags)
  const statsReady = useStatsStore((s) => Boolean(s.byRange.all))
  const { ref, columns } = useColumns(420)
  const [round, setRound] = useState(0)
  const [, setSkips] = useState(0)

  // A snapshot, not live: tagging a song mustn't pull it out from under the pointer.
  const queue = useMemo(() => {
    const u = useUserStore.getState()
    return songsToTag(songs, { songTags: u.songTags, top: useStatsStore.getState().byRange.all?.topSongs ?? [], likes: u.likes, recentIds: u.recentlyPlayed.map((r) => r.songId), downloadedAt: u.downloadedAt })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs.length, statsReady, round])

  const { tagged, total } = useMemo(() => ({ total: songs.length, tagged: songs.filter((s) => songTags[s.id]?.length).length }), [songs, songTags])
  const remaining = queue.filter((q) => !skipped.has(q.song.id))
  const visible = (remaining.length ? remaining : queue).slice(0, Math.max(4, columns * 2))
  const list = useMemo(() => visible.map((v) => v.song), [visible.map((v) => v.song.id).join()]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!total || tagged === total) return null

  const next = () => {
    for (const v of visible) skipped.add(v.song.id)
    // Went through them all: start over with whatever is still untagged.
    if (queue.every((q) => skipped.has(q.song.id))) skipped.clear()
    setRound((r) => r + 1)
  }
  const skip = (id: string) => {
    skipped.add(id)
    setSkips((n) => n + 1)
  }

  return (
    <HomeSection
      title="Songs to tag"
      action={
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => openSettings("ai")}>
            <Sparkles /> Tag with AI
          </Button>
          <Button variant="ghost" size="sm" onClick={next}>
            Next
          </Button>
        </div>
      }
    >
      <div className="mb-2 flex items-center gap-3 px-1 text-xs text-muted-foreground">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Songs tagged" aria-valuemin={0} aria-valuemax={total} aria-valuenow={tagged}>
          <div className="h-full rounded-full bg-primary transition-[width] duration-normal" style={{ width: `${(tagged / total) * 100}%` }} />
        </div>
        <span className="shrink-0 tabular-nums">
          {tagged} of {total} tagged
        </span>
      </div>
      <div ref={ref} className="grid gap-x-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {visible.map((v, i) => (
          <TagRow key={v.song.id} song={v.song} reason={v.reason} list={list} index={i} onSkip={() => skip(v.song.id)} />
        ))}
      </div>
    </HomeSection>
  )
}
