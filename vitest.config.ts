import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    include: ["src/**/*.test.ts", "electron/**/*.test.{js,cjs,ts}"],
    environment: "node",
    passWithNoTests: true,
  },
})
