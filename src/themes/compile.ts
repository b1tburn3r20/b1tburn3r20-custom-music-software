// Turns the files in src/themes/ into selectable themes at build time. Each file is exactly
// what tweakcn exports: a `:root` block (light) and a `.dark` block. Its `@theme inline`
// block isn't needed, because index.css already maps every color to Tailwind.
//
// So adding a theme means saving tweakcn's CSS as src/themes/<name>.css. Nothing else.

export type ThemeInfo = { id: string; label: string; mode: "dark" | "light"; description: string }

type Vars = Record<string, string>

/** What tweakcn doesn't export but this app uses. A theme file can set any of these itself. */
const APP_DEFAULTS: Vars = {
  "--like": "oklch(0.66 0.22 20)",
  "--success": "oklch(0.72 0.16 155)",
  "--warning": "oklch(0.8 0.15 80)",
  "--youtube": "oklch(0.63 0.24 27)",
  "--scrim": "oklch(0 0 0 / 0.55)",
  "--destructive-foreground": "oklch(0.98 0.01 27)",
  "--art-fallback-1": "147 112 219",
  "--art-fallback-2": "100 149 237",
  "--art-fallback-3": "120 200 150",
  "--art-fallback-4": "240 128 128",
  "--art-fallback-5": "230 150 190",
  "--art-fallback-6": "240 180 100",
}

/** Depth: a recessed and a raised surface around --background. Works out from any theme's background, unless it sets its own. */
const DEPTH: Record<ThemeInfo["mode"], Vars> = {
  dark: {
    "--background-dark": "color-mix(in oklch, var(--background), black 30%)",
    "--background-light": "color-mix(in oklch, var(--background), white 6%)",
  },
  light: {
    "--background-dark": "color-mix(in oklch, var(--background), black 5%)",
    "--background-light": "color-mix(in oklch, var(--background), white 60%)",
  },
}

function parseVars(body: string): Vars {
  const vars: Vars = {}
  for (const declaration of body.split(";")) {
    const m = /^\s*(--[\w-]+)\s*:\s*([\s\S]+?)\s*$/.exec(declaration)
    if (m) vars[m[1]] = m[2]
  }
  return vars
}

/** The `:root` and `.dark` variables, plus an optional leading "Name: description" comment. */
export function parseThemeFile(css: string): { light: Vars | null; dark: Vars | null; label: string | null; description: string } {
  const heading = /^\s*\/\*\s*([^:*]+?)\s*:\s*([^*]*?)\s*\*\//.exec(css)
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "")
  const blockOf = (selector: string) => {
    const m = new RegExp(`(?:^|[\\s}])${selector}\\s*\\{([^}]*)\\}`).exec(clean)
    if (!m) return null
    const vars = parseVars(m[1])
    return Object.keys(vars).length ? vars : null
  }
  return { light: blockOf(":root"), dark: blockOf("\\.dark"), label: heading ? heading[1] : null, description: heading ? heading[2] : "" }
}

const titleCase = (name: string) =>
  name
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())

const css = (id: string, mode: ThemeInfo["mode"], vars: Vars) => {
  const merged = { ...APP_DEFAULTS, ...DEPTH[mode], ...vars }
  const lines = Object.entries(merged).map(([k, v]) => `  ${k}: ${v};`)
  return `[data-theme="${id}"] {\n  color-scheme: ${mode};\n${lines.join("\n")}\n}`
}

/**
 * `files` maps a file name (without .css) to its contents. A file with one block is one
 * theme named after it; with both it gives "<name> Dark" and "<name> Light". The file
 * called "default" is plain "Dark" and "Light". Dark comes first, and "default" leads.
 */
export function compileThemes(files: Record<string, string>, warn: (message: string) => void = () => {}): { themes: ThemeInfo[]; css: string } {
  const themes: ThemeInfo[] = []
  const blocks: string[] = []
  const names = Object.keys(files).sort((a, b) => (a === "default" ? -1 : b === "default" ? 1 : a.localeCompare(b)))
  for (const name of names) {
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(name)) {
      warn(`[themes] skipping "${name}.css": use only letters, numbers, - and _ in the name.`)
      continue
    }
    const { light, dark, label, description } = parseThemeFile(files[name])
    if (!light && !dark) {
      warn(`[themes] skipping "${name}.css": it has no :root or .dark block of CSS variables.`)
      continue
    }
    const both = Boolean(light && dark)
    const base = label ?? titleCase(name)
    const add = (mode: ThemeInfo["mode"], vars: Vars) => {
      const word = mode === "dark" ? "Dark" : "Light"
      const id = name === "default" ? mode : both ? `${name}-${mode}` : name
      // "Dark text | light text", when the two versions need saying differently.
      const [forDark, forLight] = description.split("|").map((d) => d.trim())
      themes.push({ id, label: name === "default" ? word : both ? `${base} ${word}` : base, mode, description: mode === "light" ? (forLight ?? forDark) : forDark })
      blocks.push(css(id, mode, vars))
    }
    if (dark) add("dark", dark)
    if (light) add("light", light)
  }
  return { themes, css: blocks.join("\n\n") + "\n" }
}
