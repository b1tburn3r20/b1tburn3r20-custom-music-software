import { createRequire } from "module"
import fsSync from "fs"
import os from "os"
import path from "path"
import { afterEach, describe, expect, it, vi } from "vitest"

const require = createRequire(import.meta.url)
const { createDebouncedSaver, writeFileAtomic } = require("./atomic.cjs")
const fs = fsSync.promises

function tempFile() {
  return path.join(fsSync.mkdtempSync(path.join(os.tmpdir(), "b1t-atomic-")), "data.json")
}
function failure(code: string) {
  return Object.assign(new Error(code), { code })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("createDebouncedSaver", () => {
  it("settles the promise when a save fails, so awaiting callers can't hang", async () => {
    const saver = createDebouncedSaver(() => Promise.reject(new Error("disk full")), 1)
    vi.spyOn(console, "error").mockImplementation(() => {})
    await expect(saver.schedule()).rejects.toThrow("disk full")
  })

  it("can save again after a failure", async () => {
    const saveFn = vi.fn().mockRejectedValueOnce(new Error("locked")).mockResolvedValue(undefined)
    vi.spyOn(console, "error").mockImplementation(() => {})
    const saver = createDebouncedSaver(saveFn, 1)
    await expect(saver.schedule()).rejects.toThrow("locked")
    await expect(saver.schedule()).resolves.toBeUndefined()
    expect(saveFn).toHaveBeenCalledTimes(2)
  })

  it("collapses a burst of changes into one save", async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const saver = createDebouncedSaver(saveFn, 1)
    await Promise.all([saver.schedule(), saver.schedule(), saver.schedule()])
    expect(saveFn).toHaveBeenCalledTimes(1)
  })
})

describe("writeFileAtomic", () => {
  it("retries when the file is briefly locked", async () => {
    const file = tempFile()
    const rename = fs.rename.bind(fs)
    vi.spyOn(fs, "rename").mockRejectedValueOnce(failure("EPERM")).mockRejectedValueOnce(failure("EBUSY")).mockImplementation(rename)
    await writeFileAtomic(file, "saved")
    expect(fsSync.readFileSync(file, "utf-8")).toBe("saved")
  })

  it("gives up on an error that retrying can't fix, and leaves no temp file behind", async () => {
    const file = tempFile()
    const spy = vi.spyOn(fs, "rename").mockRejectedValue(failure("ENOSPC"))
    await expect(writeFileAtomic(file, "saved")).rejects.toThrow("ENOSPC")
    expect(spy).toHaveBeenCalledTimes(1)
    expect(fsSync.readdirSync(path.dirname(file))).toEqual([])
  })
})
