import { describe, expect, it } from "vitest"
import { canonicalTag, GENRE_GROUPS, likelyTypoOf, looseKey, tagFamily, tagMatches } from "./tagPresets"

describe("canonicalTag", () => {
  it("turns other spellings into the standard name", () => {
    for (const typed of ["hiphop", "Hip-Hop", "HIP HOP"]) expect(canonicalTag(typed)).toBe("hip hop")
    expect(canonicalTag("synthpop")).toBe("synth-pop")
    expect(canonicalTag("Drum & Bass")).toBe("drum and bass")
  })
  it("understands common abbreviations", () => {
    expect(canonicalTag("rnb")).toBe("r&b")
    expect(canonicalTag("DnB")).toBe("drum and bass")
    expect(canonicalTag("OST")).toBe("soundtrack")
  })
  it("keeps a spelling you already use", () => {
    expect(canonicalTag("hip hop", ["HipHop"])).toBe("HipHop")
    expect(canonicalTag("rnb", ["R&B"])).toBe("R&B")
  })
  it("still allows new tags, tidied", () => {
    expect(canonicalTag("  late   night  ")).toBe("late night")
  })
})

describe("tagMatches", () => {
  it("finds parts of a name", () => {
    expect(tagMatches("hip hop", "hop")).toBe(true)
    expect(tagMatches("hip hop", "jazz")).toBe(false)
  })
  it("finds near misses", () => {
    expect(tagMatches("electronic", "electornic")).toBe(true)
    expect(tagMatches("metal", "metla")).toBe(false) // two edits is too far for a short word
    expect(tagMatches("metal", "metl")).toBe(true)
  })
})

describe("likelyTypoOf", () => {
  const names = ["electronic", "rock", "chill"]
  it("spots a misspelling", () => {
    expect(likelyTypoOf("electornic", names)).toBe("electronic")
  })
  it("leaves exact names, unrelated words and very short words alone", () => {
    expect(likelyTypoOf("electronic", names)).toBeNull()
    expect(likelyTypoOf("late night", names)).toBeNull()
    expect(likelyTypoOf("roc", names)).toBeNull()
  })
})

describe("tagFamily", () => {
  it("groups genres and your own variants of them", () => {
    expect(tagFamily("trap")).toBe("Hip hop")
    expect(tagFamily("chill rap")).toBe("Hip hop")
    expect(tagFamily("Shoegaze")).toBe("Rock")
  })
  it("leaves moods and unrelated genres out", () => {
    expect(tagFamily("sad")).toBeNull()
    expect(tagFamily("jazz")).toBeNull()
  })
})

describe("GENRE_GROUPS", () => {
  it("has no two names that count as the same tag", () => {
    const keys = GENRE_GROUPS.flatMap((g) => g.genres).map(looseKey)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
