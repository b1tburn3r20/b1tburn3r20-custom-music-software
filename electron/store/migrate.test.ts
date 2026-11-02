import { createRequire } from "module"
import { describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const m = require("./migrate.cjs")

let n = 0
const newId = () => `id${++n}`

const legacyCache = {
  version: 4,
  songCache: {
    rootDir: "/music",
    songs: [
      { name: "A.mp3", path: "/music/A.mp3", metadata: { title: "Same", artist: "X, Y", album: "Al", duration: 100, thumbnail: "file:///cfg/thumbnails/aaa.jpg" } },
      { name: "B.mp3", path: "/music/B.mp3", metadata: { title: "Same", artist: "Z", album: "Unknown Album", duration: 50 } },
      { name: "C [dQw4w9WgXcQ].mp3", path: "/music/C [dQw4w9WgXcQ].mp3", metadata: { title: "C", artist: "Q" } },
    ],
  },
}

describe("migrateLegacyLibrary", () => {
  it("assigns unique ids and keeps same-titled songs distinct", () => {
    n = 0
    const { library, report } = m.migrateLegacyLibrary(legacyCache, { newId })
    expect(report.songs).toBe(3)
    const songs = Object.values(library.songs) as any[]
    expect(new Set(songs.map((s) => s.id)).size).toBe(3)
    expect(songs.filter((s) => s.metadata.title === "Same")).toHaveLength(2)
    expect(library.rootDir).toBe("/music")
    const a = songs.find((s) => s.path === "/music/A.mp3")
    expect(a.metadata.artists).toEqual(["X", "Y"])
    expect(a.thumbnailFile).toBe("aaa.jpg")
    expect(songs.find((s) => s.path === "/music/B.mp3").metadata.album).toBeNull()
    expect(songs.find((s) => s.fileName.startsWith("C")).sourceId).toBe("dQw4w9WgXcQ")
  })
})

describe("migrateLegacyPlaylists", () => {
  it("maps paths to ids, keeps unresolved paths, dedupes songs and names", () => {
    n = 0
    const { library } = m.migrateLegacyLibrary(legacyCache, { newId })
    const idx = m.pathIndex(library)
    const { playlists, report } = m.migrateLegacyPlaylists(
      {
        playlists: [
          { id: "p1", name: "Rock", songs: ["/music/A.mp3", "/music/A.mp3", "/gone.mp3"] },
          { id: "p2", name: "rock ", songs: ["/music/B.mp3"] },
        ],
      },
      idx,
    )
    expect(playlists[0].songIds).toEqual([idx.get("/music/A.mp3")])
    expect(playlists[0].unresolvedPaths).toEqual(["/gone.mp3"])
    expect(report.duplicateSongsRemoved).toBe(1)
    expect(playlists[1].name).toBe("rock (2)")
    expect(report.unresolved).toHaveLength(1)
  })
})

describe("importRendererLegacy", () => {
  const setup = () => {
    n = 0
    const { library } = m.migrateLegacyLibrary(legacyCache, { newId })
    return { idx: m.pathIndex(library), user: m.emptyUserState() }
  }

  it("imports likes, history, downloads and settings once per origin", () => {
    const { idx, user } = setup()
    const dump = {
      likedSongs: JSON.stringify([{ path: "/music/A.mp3" }, { path: "/missing.mp3", metadata: { title: "Lost" } }]),
      recentlyPlayed: JSON.stringify([{ path: "/music/B.mp3" }, { path: "/music/B.mp3" }]),
      userRecentlyDownloaded: JSON.stringify([{ path: "/music/C [dQw4w9WgXcQ].mp3" }]),
      userRecentlyPlayedPlaylists: JSON.stringify([{ id: "p1" }, { id: "nope" }]),
      musicVolume: "33",
      userLoopingPreferance: "noLoop",
      userSettingZenModeTimout: "5000",
      userSettingExpandOnPlayToggle: "true",
    }
    const ctx = { origin: "http://localhost:5173", pathToId: idx, playlistIds: new Set(["p1"]), now: 1 }
    const { user: u1, report } = m.importRendererLegacy(user, dump, ctx)
    expect(u1.likes.map((l: any) => l.songId)).toEqual([idx.get("/music/A.mp3")])
    expect(u1.recentlyPlayed).toHaveLength(1)
    expect(u1.recentlyDownloaded).toHaveLength(1)
    expect(u1.recentPlaylists).toEqual(["p1"])
    expect(u1.settings.volume).toBe(33)
    expect(u1.settings.repeat).toBe("off")
    expect(u1.settings.zenTimeout).toBe(5000)
    expect(u1.settings.expandOnPlay).toBe(true)
    expect(report.unresolved).toHaveLength(1)
    expect(u1.legacyUnresolved[0].title).toBe("Lost")
    expect(user.likes).toHaveLength(0) // input not mutated

    // Unlike after import, then re-import the same origin: must not come back.
    u1.likes = []
    const { user: u2, report: r2 } = m.importRendererLegacy(u1, dump, ctx)
    expect(r2.skipped).toBe(true)
    expect(u2.likes).toHaveLength(0)
  })

  it("flags likes that are an exact copy of recent downloads (old bug)", () => {
    const { idx, user } = setup()
    const songs = [{ path: "/music/A.mp3" }, { path: "/music/B.mp3" }, { path: "/music/C [dQw4w9WgXcQ].mp3" }]
    const dump = { likedSongs: JSON.stringify(songs), userRecentlyDownloaded: JSON.stringify(songs) }
    const { user: u, report } = m.importRendererLegacy(user, dump, { origin: "o", pathToId: idx, playlistIds: new Set(), now: 1 })
    expect(report.suspectedLikesCorruption).toBe(true)
    expect(u.likes).toHaveLength(3) // still imported — never dropped
    expect(u.notices).toHaveLength(1)
  })

  it("still flags when a few real likes were added after the corruption", () => {
    n = 0
    const songs = Array.from({ length: 12 }, (_, i) => ({ name: `s${i}.mp3`, path: `/m/s${i}.mp3`, metadata: { title: `t${i}` } }))
    const { library } = m.migrateLegacyLibrary({ songCache: { rootDir: "/m", songs } }, { newId })
    const idx = m.pathIndex(library)
    const downloads = songs.slice(0, 11)
    const likes = [songs[11], ...downloads] // 1 genuine + 11 copied
    const { report } = m.importRendererLegacy(m.emptyUserState(), { likedSongs: JSON.stringify(likes), userRecentlyDownloaded: JSON.stringify(downloads) }, { origin: "o", pathToId: idx, playlistIds: new Set(), now: 1 })
    expect(report.suspectedLikesCorruption).toBe(true)
    expect(report.likesAlsoInDownloads).toBe(11)
  })
})
