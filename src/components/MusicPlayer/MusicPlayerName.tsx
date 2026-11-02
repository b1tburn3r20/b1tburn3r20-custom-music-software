import { usePlayerStore } from "@/stores/usePlayerStore"
import { useSettingsStore } from "@/stores/useSettingsStore"
import { Artwork } from "@/components/base/Artwork"
import { songArtists } from "@/lib/catalog"
import { openAlbumForSong, openArtist } from "@/utils/musicutils"
import MusicPlayerTimeRunning from "./components/MusicPlayerTimeRunning"

const MusicPlayerName = () => {
  const song = usePlayerStore((s) => s.currentlyPlaying)
  const collapse = () => useSettingsStore.getState().setPlayerExpanded(false)
  if (!song) return null
  const m = song.metadata
  const artists = songArtists(song)
  return (
    <div className="flex min-w-0 select-none items-center gap-3">
      <Artwork src={m.thumbnail} size="sm" />
      <div className="min-w-0">
        <div className="truncate font-medium" title={m.title}>
          {m.title}
        </div>
        <div className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
          <span className="truncate">
            {(artists.length ? artists : [m.artist]).map((a, i) => (
              <span key={a}>
                <button type="button" className="hover:text-foreground hover:underline" onClick={() => { collapse(); openArtist(a) }}>
                  {a}
                </button>
                {i < artists.length - 1 && ", "}
              </span>
            ))}
            {m.album && (
              <>
                {" · "}
                <button type="button" className="hover:text-foreground hover:underline" onClick={() => { collapse(); openAlbumForSong(song.id) }}>
                  {m.album}
                </button>
                {m.year ? ` (${m.year})` : ""}
              </>
            )}
          </span>
          <span aria-hidden>·</span>
          <MusicPlayerTimeRunning className="shrink-0" />
        </div>
      </div>
    </div>
  )
}

export default MusicPlayerName
