import { createRequire } from "module"
import fs from "fs"
import os from "os"
import path from "path"
import { describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const { buildTestMp3, isSmokeTest, SMOKE_TITLE } = require("./smoke.cjs")
const { readAudioMetadata } = require("./lib/media.cjs")

describe("smoke test helpers", () => {
  it("builds an MP3 whose tag can be told apart from the filename fallback", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "b1t-smoke-test-"))
    const file = path.join(dir, "filename-fallback.mp3")
    fs.writeFileSync(file, buildTestMp3())
    const { metadata } = await readAudioMetadata(file)
    expect(metadata.title).toBe(SMOKE_TITLE)
    expect(metadata.duration).toBeGreaterThan(0)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it("only runs when asked", () => {
    expect(isSmokeTest(["electron", "main.cjs"])).toBe(false)
    expect(isSmokeTest(["electron", "main.cjs", "--smoke-test"])).toBe(true)
  })
})
