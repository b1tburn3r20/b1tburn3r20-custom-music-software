import { describe, expect, it } from "vitest"
import fs from "fs"
import path from "path"
import { compileThemes, parseThemeFile } from "./compile"

// The shape tweakcn exports.
const TWEAKCN = `:root {
  --background: oklch(0.98 0 0);
  --foreground: oklch(0.2 0 0);
  --primary: oklch(0.6 0.2 300);
  --radius: 0.5rem;
  --font-sans: Inter, sans-serif;
  --shadow-sm: 0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 1px 2px -1px hsl(0 0% 0% / 0.10);
}

.dark {
  --background: oklch(0.15 0 0);
  --foreground: oklch(0.95 0 0);
  --primary: oklch(0.7 0.2 300);
}

@theme inline {
  --color-background: var(--background);
  --font-sans: var(--font-sans);
}
`

describe("parseThemeFile", () => {
  it("reads a tweakcn export, ignoring its @theme block", () => {
    const { light, dark } = parseThemeFile(TWEAKCN)
    expect(light?.["--primary"]).toBe("oklch(0.6 0.2 300)")
    expect(dark?.["--background"]).toBe("oklch(0.15 0 0)")
    expect(light?.["--color-background"]).toBeUndefined()
    expect(dark?.["--color-background"]).toBeUndefined()
  })
  it("keeps values with commas and spaces whole", () => {
    expect(parseThemeFile(TWEAKCN).light?.["--shadow-sm"]).toContain("0 1px 2px -1px")
  })
  it("isn't confused by a selector that only ends the same way", () => {
    expect(parseThemeFile(`.not-dark { --a: 1; }`).dark).toBeNull()
  })
  it("reads an optional name and description", () => {
    expect(parseThemeFile(`/* Midnight: True black */\n.dark { --a: 1; }`)).toMatchObject({ label: "Midnight", description: "True black" })
  })
})

describe("compileThemes", () => {
  const { themes, css } = compileThemes({ "neo-brutal": TWEAKCN })

  it("makes a dark and a light theme from one tweakcn file", () => {
    expect(themes).toEqual([
      { id: "neo-brutal-dark", label: "Neo Brutal Dark", mode: "dark", description: "" },
      { id: "neo-brutal-light", label: "Neo Brutal Light", mode: "light", description: "" },
    ])
    expect(css).toContain(`[data-theme="neo-brutal-dark"]`)
    expect(css).toContain(`color-scheme: dark`)
  })
  it("fills in what tweakcn doesn't export, so the app's own colors still work", () => {
    for (const name of ["--like", "--success", "--warning", "--youtube", "--scrim", "--art-fallback-1"]) expect(css).toContain(name)
  })
  it("adds depth to every theme, worked out from its own background", () => {
    expect(css).toMatch(/--background-dark: color-mix\(in oklch, var\(--background\), black/)
    expect(css).toMatch(/--background-light: color-mix\(in oklch, var\(--background\), white/)
  })
  it("lets a theme set its own depth colors, and its own version of anything", () => {
    const out = compileThemes({ x: `.dark { --background: #000; --background-dark: #111; --like: #f00; }` }).css
    expect(out).toContain("--background-dark: #111")
    expect(out).not.toContain("--background-dark: color-mix")
    expect(out).toContain("--like: #f00")
  })
  it("names a one-block file after the file", () => {
    expect(compileThemes({ midnight: `.dark { --a: 1; }` }).themes[0]).toMatchObject({ id: "midnight", label: "Midnight", mode: "dark" })
    expect(compileThemes({ paper: `:root { --a: 1; }` }).themes[0]).toMatchObject({ id: "paper", label: "Paper", mode: "light" })
  })
  it("warns about and skips a file with nothing usable, rather than breaking the build", () => {
    const warnings: string[] = []
    expect(compileThemes({ broken: "not css at all", "bad name!": TWEAKCN }, (w) => warnings.push(w)).themes).toEqual([])
    expect(warnings).toHaveLength(2)
  })
})

describe("the themes in this repo", () => {
  const dir = __dirname
  const files = Object.fromEntries(
    fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".css"))
      .map((f) => [path.basename(f, ".css"), fs.readFileSync(path.join(dir, f), "utf-8")]),
  )
  const { themes } = compileThemes(files)

  it("keep the ids people have saved, so nobody's choice resets", () => {
    expect(themes.map((t) => t.id)).toEqual(expect.arrayContaining(["dark", "light", "midnight", "sunset"]))
  })
  it("describe light and dark separately when they differ", () => {
    expect(themes.find((t) => t.id === "light")?.description).toBe("Bright and clean")
    expect(themes.find((t) => t.id === "dark")?.description).toBe("The original look")
  })
  it("lead with Dark, the default", () => {
    expect(themes[0]).toMatchObject({ id: "dark", label: "Dark", mode: "dark" })
  })
  it("define every color a shadcn component needs", () => {
    for (const name of Object.keys(files)) {
      const { dark, light } = parseThemeFile(files[name])
      for (const vars of [dark, light]) {
        if (!vars) continue
        for (const key of ["--background", "--foreground", "--card", "--popover", "--primary", "--secondary", "--muted", "--accent", "--destructive", "--border", "--input", "--ring", "--radius", "--sidebar", "--chart-1"]) {
          expect(vars[key], `${name}: ${key}`).toBeTruthy()
        }
      }
    }
  })
})
