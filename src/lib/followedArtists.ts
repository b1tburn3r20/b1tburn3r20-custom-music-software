// Connects the channels someone subscribes to with the artists in their library.
import type { Song } from "@/types/DirectoryTypes"
import { artistKey } from "../../shared/songMatch.mjs"

type Subscription = { channelId: string; title: string }

const artistsOf = (song: Song) => (song.metadata.artists?.length ? song.metadata.artists : [song.metadata.artist])

/** Every library song by an artist the user follows. Matches any channel, not just "- Topic" or VEVO ones. */
export function followedSongIds(songs: readonly Song[], subscriptions: readonly Subscription[]): Set<string> {
  const followed = new Set(subscriptions.map((s) => artistKey(s.title)).filter(Boolean))
  const ids = new Set<string>()
  if (!followed.size) return ids
  for (const song of songs) {
    if (artistsOf(song).some((a) => followed.has(artistKey(a)))) ids.add(song.id)
  }
  return ids
}

/** Subscriptions matching an artist in the library, for showing how many are shaping radio. */
export function matchedSubscriptions<S extends Subscription>(songs: readonly Song[], subscriptions: readonly S[]): S[] {
  const artists = new Set(songs.flatMap((s) => artistsOf(s).map(artistKey)))
  return subscriptions.filter((s) => artists.has(artistKey(s.title)))
}
