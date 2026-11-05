#!/usr/bin/env node
// Fails if a Google credential ended up in the built app. Credentials are only ever
// entered by the user at runtime, so the build should never contain one.
// Usage: node scripts/check-secrets.cjs [folder...]   (default: dist)
const fs = require("fs");
const path = require("path");

const PATTERNS = [
  ["Google API key", /AIza[0-9A-Za-z_-]{35}/],
  ["Google OAuth client secret", /GOCSPX-[0-9A-Za-z_-]{20,}/],
  ["Google refresh token", /\b1\/\/0[0-9A-Za-z_-]{30,}/],
  ["Anthropic API key", /sk-ant-[0-9A-Za-z_-]{20,}/],
  ["OpenAI API key", /sk-(proj-)?[0-9A-Za-z_-]{32,}/],
  ["compiled-in key setting", /VITE_YOUTUBE_API_KEY/],
];

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const roots = process.argv.slice(2);
let scanned = 0;
const found = [];
for (const root of roots.length ? roots : ["dist"]) {
  for (const file of walk(root)) {
    scanned++;
    const text = fs.readFileSync(file).toString("latin1");
    for (const [label, re] of PATTERNS) if (re.test(text)) found.push(`${file}: ${label}`);
  }
}
if (!scanned) {
  console.error("[secrets] nothing to scan. Run the build first.");
  process.exit(1);
}
if (found.length) {
  console.error(`[secrets] found credentials in the build:\n  ${found.join("\n  ")}`);
  process.exit(1);
}
console.log(`[secrets] ${scanned} files scanned, no credentials found.`);
