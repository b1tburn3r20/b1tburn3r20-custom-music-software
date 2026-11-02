// The one place that defines what you can do with a song. Every song row in
// the app (library, playlists, albums, artist, search, queue, history, liked,
// downloads) renders these entries.
import { useMemo } from "react"
import { Disc3, FolderOpen, Heart, HeartOff, ListEnd, ListMusic, ListPlus, ListStart, Mic2, Play, Plus, Tags, Trash2, X } from "lucide-react"
import type { Song } from "@/types/DirectoryTypes"
import type { QueueContext } from "@/player/queue"
import { addToQueue, playFromList, playNext, playRadio, removeFromQueue } from "@/player/controls"
import { addSongToPlaylists, removeSongFromPlaylist, setLiked } from "@/lib/actions"
import { useUserStore } from "@/stores/useUserStore"
import { dialogs } from "@/stores/useDialogStore"
import { openAlbumForSong, openArtist } from "@/utils/musicutils"
import { songArtists } from "@/lib/catalog"
import type { MenuEntry } from "./menu"

export type SongContext = {
  /** The list the song is shown in; Play queues this list. Omit for a radio queue. */
  list?: readonly Song[]
  queueContext?: QueueContext | null
  /** Shown inside this playlist → adds "Remove from playlist". */
  playlistId?: string
  /** Shown in the queue → adds "Remove from queue". */
  queueUid?: string
  /** Called before navigating away (e.g. to collapse the expanded player). */
  onNavigate?: () => void
}

const EMPTY: never[] = []

export function playSongInContext(song: Song, ctx: SongContext) {
  if (ctx.list && ctx.list.length) playFromList(ctx.list, song, ctx.queueContext ?? null)
  else playRadio(song)
}

export function useSongMenu(song: Song, ctx: SongContext, enabled = true): MenuEntry[] {
  const playlists = useUserStore((s) => (enabled ? s.playlists : EMPTY))
  const liked = useUserStore((s) => s.likedIds.has(song.id))

  return useMemo(() => {
    if (!enabled) return []
    const entries: MenuEntry[] = [
      { kind: "item", key: "play", label: "Play", icon: Play, onSelect: () => playSongInContext(song, ctx) },
      { kind: "item", key: "next", label: "Play next", icon: ListStart, onSelect: () => playNext([song]) },
      { kind: "item", key: "queue", label: "Add to queue", icon: ListEnd, onSelect: () => addToQueue([song]) },
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
    entries.push({ kind: "item", key: "tags", label: "Tags…", icon: Tags, onSelect: () => dialogs().openTags([song]) })
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
  }, [enabled, song, liked, playlists, ctx.list, ctx.queueContext, ctx.playlistId, ctx.queueUid])
}
