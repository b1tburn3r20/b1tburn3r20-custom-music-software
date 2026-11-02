import { usePlayerStore } from "@/stores/usePlayerStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { Artwork } from "@/components/base/Artwork";
import { songArtists } from "@/lib/catalog";
import { openAlbumForSong, openArtist } from "@/utils/musicutils";
import MusicPlayerTimeRunning from "./components/MusicPlayerTimeRunning";

const MusicPlayerName = () => {
  const song = usePlayerStore((s) => s.currentlyPlaying);
  const collapse = () => useSettingsStore.getState().setPlayerExpanded(false);
  if (!song) return null;
  const m = song.metadata;
  const artists = songArtists(song);
  return (
    <div className="flex min-w-0 select-none items-center gap-3">
      <Artwork src={m.thumbnail} size="sm" />
      <div className="min-w-0">
        <div className="truncate font-medium" title={m.title}>
          {m.title}
        </div>
        {/* Each part truncates on its own (the artist list gives way first, the album keeps a minimum); the time never shrinks. */}
        <div className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
          <span className="min-w-8 shrink-[3] truncate" title={m.artist}>
            {(artists.length ? artists : [m.artist]).map((a, i) => (
              <span key={a}>
                <button type="button" className="inline hover:text-foreground hover:underline" onClick={() => { collapse(); openArtist(a) }}>
                  {a}
                </button>
                {i < artists.length - 1 && ", "}
              </span>
            ))}
          </span>
          {m.album && (
            <>
              <span aria-hidden className="shrink-0">·</span>
              <span className="min-w-16 shrink truncate" title={`${m.album}${m.year ? ` (${m.year})` : ""}`}>
                <button type="button" className="inline hover:text-foreground hover:underline" onClick={() => { collapse(); openAlbumForSong(song.id) }}>
                  {m.album}
                </button>
                {m.year ? ` (${m.year})` : ""}
              </span>
            </>
          )}
          <span aria-hidden className="shrink-0">·</span>
          <MusicPlayerTimeRunning className="shrink-0" />
        </div>
      </div>
    </div>
  );
};

export default MusicPlayerName;
