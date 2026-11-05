import fs from "fs"
import path from "path"
import { createRequire } from "module"
import { compileThemes } from "./src/themes/compile"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

const { faviconFile } = createRequire(import.meta.url)("./electron/lib/appIcon.cjs")

/** Links whichever icon exists in public/, so the link can never point at a missing file. */
function favicon(): Plugin {
  return {
    name: "b1t-favicon",
    transformIndexHtml: () => {
      const { href, type } = faviconFile((file: string) => fs.existsSync(path.resolve(__dirname, "public", file)))
      return [{ tag: "link", attrs: { rel: "icon", type, href }, injectTo: "head" }]
    },
  }
}

/**
 * Every CSS file in src/themes/ becomes selectable themes, so adding one from tweakcn is just
 * saving a file. Compiled here rather than at runtime, so there's no flash of no colors.
 */
function themes(): Plugin {
  const dir = path.resolve(__dirname, "src/themes")
  const CSS_ID = "virtual:b1t-themes.css"
  const LIST_ID = "virtual:b1t-themes"
  const compile = () => compileThemes(Object.fromEntries(fs.readdirSync(dir).filter((f) => f.endsWith(".css")).map((f) => [path.basename(f, ".css"), fs.readFileSync(path.join(dir, f), "utf-8")])), console.warn)
  return {
    name: "b1t-themes",
    resolveId: (id) => (id === CSS_ID || id === LIST_ID ? `\0${id}` : null),
    load(id) {
      if (id !== `\0${CSS_ID}` && id !== `\0${LIST_ID}`) return null
      for (const f of fs.readdirSync(dir)) if (f.endsWith(".css")) this.addWatchFile(path.join(dir, f))
      const { themes: list, css } = compile()
      return id === `\0${CSS_ID}` ? css : `export const THEMES = ${JSON.stringify(list)}`
    },
  }
}

// Production only: the dev server needs inline scripts and a websocket for hot reload.
const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: media: https://*.ytimg.com https://*.ggpht.com https://*.googleusercontent.com",
  "media-src media: blob:",
  "connect-src 'self' media:",
  "frame-src https://www.youtube.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ")

function contentSecurityPolicy(): Plugin {
  return {
    name: "b1t-content-security-policy",
    apply: "build",
    transformIndexHtml: () => [
      { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: CONTENT_SECURITY_POLICY }, injectTo: "head-prepend" },
    ],
  }
}

export default defineConfig({
  base: "./",
  plugins: [themes(), react(), tailwindcss(), favicon(), contentSecurityPolicy()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
