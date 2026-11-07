import { describe, expect, it } from "vitest"
import { importLabel } from "./playlistImport"

const remote = { id: "PLroad", title: "Road Trip", count: 3 }
const songs = (n: number) => Array.from({ length: n }, (_, i) => `s${i}`)
const mirror = (n: number) => ({ name: "Anything", songIds: songs(n), source: { type: "youtube", id: "PLroad" } })

describe("importLabel", () => {
  it("marks a finished import, even if it was renamed", () => {
    expect(importLabel(remote, [mirror(3)])).toBe("Imported")
  })
  it("shows how far an unfinished import got", () => {
    expect(importLabel(remote, [mirror(2)])).toBe("2 of 3 imported")
  })
  it("calls a same-named playlist of the same length likely installed, ignoring case", () => {
    expect(importLabel(remote, [{ name: " road trip ", songIds: songs(3) }])).toBe("Likely installed")
  })
  it("needs both the name and the length to match", () => {
    expect(importLabel(remote, [{ name: "Road Trip", songIds: songs(2) }])).toBeNull()
    expect(importLabel(remote, [{ name: "Other", songIds: songs(3) }])).toBeNull()
  })
  it("says nothing while the size is unknown, or for an empty playlist", () => {
    expect(importLabel({ ...remote, count: null }, [mirror(3)])).toBeNull()
    expect(importLabel({ ...remote, count: 0 }, [{ name: "Road Trip", songIds: [] }])).toBeNull()
  })
})
