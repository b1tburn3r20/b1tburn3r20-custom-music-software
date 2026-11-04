// The one place that defines what you can do with a song. Every song row in
// the app (library, playlists, albums, artist, search, queue, history, liked,
// downloads) renders these entries.
import { useMemo } from "react"
import { Disc3, FolderOpen, Heart, HeartOff, ListEnd, ListMusic, ListPlus, ListStart, Mic2, Play, Plus, Radio, Tags, Trash2, X } from "lucide-react"
import type { Song } from "@/types/DirectoryTypes"
import type { QueueContext } from "@/player/queue"
import { addToQueue, playFromList, playNext, playRadio, removeFromQueue } from "@/player/controls"
import { addSongToPlaylists, addTagToSongs, removeSongFromPlaylist, removeTagFromSongs, setLiked } from "@/lib/actions"
import { useUserStore } from "@/stores/useUserStore"
import { dialogs } from "@/stores/useDialogStore"
import { openAlbumForSong, openArtist } from "@/utils/musicutils"
import { songArtists } from "@/lib/catalog"
import type { MenuEntry } from "./menu"

export type SongContext = {
  /** The list the song is shown in; Play queues this list. Omit for a radio queue. */
  list?: readonly Song[]
  /**
   * For lists you browse rather than listen through (recent downloads, search results,
   * all songs): their order means nothing, so playing a song starts its radio instead.
   */
  startRadio?: boolean
  queueContext?: QueueContext | null
  /** Shown inside this playlist → adds "Remove from playlist". */
  playlistId?: string
  /** Shown in the queue → adds "Remove from queue". */
  queueUid?: string
  /** Called before navigating away (e.g. to collapse the expanded player). */
  onNavigate?: () => void
}

const EMPTY: never[] = []
const EMPTY_TAGS: Record<string, string[]> = {}

export function playSongInContext(song: Song, ctx: SongContext) {
  if (ctx.list && ctx.list.length && !ctx.startRadio) playFromList(ctx.list, song, ctx.queueContext ?? null)
  else playRadio(song)
}

export function useSongMenu(song: Song, ctx: SongContext, enabled = true): MenuEntry[] {
  const playlists = useUserStore((s) => (enabled ? s.playlists : EMPTY))
  const liked = useUserStore((s) => s.likedIds.has(song.id))
  const songTags = useUserStore((s) => (enabled ? s.songTags : EMPTY_TAGS))
  // Your tags, most used first, for one-click toggling.
  const allTags = useMemo(() => {
    const counts = new Map<string, { name: string; n: number }>()
    for (const list of Object.values(songTags)) for (const t of list) counts.set(t.toLowerCase(), { name: t, n: (counts.get(t.toLowerCase())?.n ?? 0) + 1 })
    return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 20).map((c) => c.name)
  }, [songTags])

  return useMemo(() => {
    if (!enabled) return []
    const entries: MenuEntry[] = [
      { kind: "item", key: "play", label: "Play", icon: Play, onSelect: () => playSongInContext(song, ctx) },
      { kind: "item", key: "next", label: "Play next", icon: ListStart, onSelect: () => playNext([song]) },
      { kind: "item", key: "queue", label: "Add to queue", icon: ListEnd, onSelect: () => addToQueue([song]) },
      { kind: "item", key: "radio", label: "Start radio", icon: Radio, onSelect: () => playRadio(song) },
      { kind: "separator", key: "s1" },
      {
        kind: "sub",
        key: "playlist",
        label: "Add to playlist",
        icon: ListPlus,
        children: [
          { kind: "item", key: "new", label: "New playlist…", icon: Plus, onSelect: () => dialogs().openPlaylistForm({ mode: "create", songIds: [song.id] }) },
          { kind: "item", key: "many", label: "Choose playlists…", icon: ListMusic, onSelect: () => dialogs().openAddToPlaylist([song]) },
          ...(playlists.length ? [{ kind: "separator" as const, key: "ps" }] : []),
          ...playlists.map((p): MenuEntry => {
            const has = p.songIds.includes(song.id)
            return { kind: "item", key: p.id, label: p.name, checked: has, disabled: has, onSelect: () => void addSongToPlaylists(song.id, [p.id]) }
          }),
        ],
      },
    ]
    if (ctx.playlistId) {
      const pid = ctx.playlistId
      entries.push({ kind: "item", key: "rmpl", label: "Remove from this playlist", icon: X, onSelect: () => void removeSongFromPlaylist(pid, song.id) })
    }
    if (ctx.queueUid) {
      const uid = ctx.queueUid
      entries.push({ kind: "item", key: "rmq", label: "Remove from queue", icon: X, onSelect: () => removeFromQueue(uid) })
    }
    entries.push({ kind: "item", key: "like", label: liked ? "Remove from Liked Songs" : "Add to Liked Songs", icon: liked ? HeartOff : Heart, onSelect: () => void setLiked(song.id, !liked) })
    const mine = new Set((songTags[song.id] ?? []).map((t) => t.toLowerCase()))
    entries.push({
      kind: "sub",
      key: "tags",
      label: mine.size ? `Tags (${[...(songTags[song.id] ?? [])].slice(0, 2).join(", ")}${mine.size > 2 ? "…" : ""})` : "Tag",
      icon: Tags,
      children: [
        { kind: "item", key: "edit", label: "Edit tags…  (T)", icon: Plus, onSelect: () => dialogs().openTags([song]) },
        ...(allTags.length ? [{ kind: "separator" as const, key: "ts" }] : []),
        ...allTags.map((t): MenuEntry => {
          const has = mine.has(t.toLowerCase())
          return { kind: "item", key: `t:${t}`, label: t, checked: has, onSelect: () => void (has ? removeTagFromSongs([song.id], t) : addTagToSongs([song.id], t)) }
        }),
      ],
    })
    entries.push({ kind: "separator", key: "s2" })

    const artists = songArtists(song)
    const go = (fn: () => void) => () => {
      ctx.onNavigate?.()
      fn()
    }
    if (artists.length === 1) entries.push({ kind: "item", key: "artist", label: `Go to ${artists[0]}`, icon: Mic2, onSelect: go(() => openArtist(artists[0])) })
    else if (artists.length > 1)
      entries.push({
        kind: "sub",
        key: "artist",
        label: "Go to artist",
        icon: Mic2,
        children: artists.map((a) => ({ kind: "item" as const, key: a, label: a, onSelect: go(() => openArtist(a)) })),
      })
    if (song.metadata.album) entries.push({ kind: "item", key: "album", label: "Go to album", icon: Disc3, onSelect: go(() => openAlbumForSong(song.id)) })
    entries.push({ kind: "item", key: "folder", label: "Show in folder", icon: FolderOpen, onSelect: () => void window.api.library.showInFolder(song.id) })
    entries.push({ kind: "separator", key: "s3" })
    entries.push({ kind: "item", key: "delete", label: "Delete from library…", icon: Trash2, destructive: true, onSelect: () => dialogs().confirmDeleteSong(song) })
    return entries
    // ctx is a fresh object per render; its fields are what matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, song, liked, playlists, songTags, allTags, ctx.list, ctx.queueContext, ctx.playlistId, ctx.queueUid])
}
