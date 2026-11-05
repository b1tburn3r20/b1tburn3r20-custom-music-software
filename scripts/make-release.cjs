#!/usr/bin/env node
// Builds the release files: the source tarball, and the install scripts with every hash
// filled in, so a script only ever installs exactly what it shipped with.
// Usage: node scripts/make-release.cjs <output dir> [--worktree]
//   --worktree packs uncommitted files too, for testing an install before a release.
const { execFileSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const repo = path.join(__dirname, "..");
const out = path.resolve(process.argv[2] || "release-assets");
const worktree = process.argv.includes("--worktree");
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf-8", maxBuffer: 1024 * 1024 * 64 });

/** Fills the placeholders in an install script. Throws if any would be left behind. */
function stamp(script, { version, sourceSha256, nodeHashes }) {
  const filled = script
    .replaceAll("__B1T_VERSION__", version)
    .replaceAll("__B1T_SOURCE_SHA256__", sourceSha256)
    .replace(/__NODE_SHA_([a-z0-9-]+)__/g, (_m, key) => {
      if (!nodeHashes[key]) throw new Error(`No Node hash for ${key}`);
      return nodeHashes[key];
    });
  const left = /__(B1T|NODE_SHA)_[A-Za-z0-9_-]*__/.exec(filled);
  if (left) throw new Error(`Unfilled placeholder: ${left[0]}`);
  return filled;
}

function main() {
  const { version } = JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf-8"));
  const manifest = JSON.parse(fs.readFileSync(path.join(repo, "installer", "tools-manifest.json"), "utf-8"));
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  const tarball = path.join(out, "source.tar.gz");
  const tracked = git("ls-files", ...(worktree ? ["--cached", "--others", "--exclude-standard"] : [])).split("\n").filter(Boolean);
  // The stock install.ps1 at the repo root is not part of this project.
  const files = tracked.filter((f) => f !== "install.ps1" && fs.existsSync(path.join(repo, f)));
  const listFile = path.join(out, ".files");
  fs.writeFileSync(listFile, files.join("\n") + "\n");
  // Run from the repo with relative paths: Windows' tar reads "C:\..." as a remote host.
  execFileSync("tar", ["-czf", path.relative(repo, tarball), "-T", path.relative(repo, listFile)], { cwd: repo, stdio: "inherit" });
  fs.rmSync(listFile);

  const sourceSha256 = sha256(tarball);
  for (const name of ["install.sh", "install.ps1"]) {
    const script = fs.readFileSync(path.join(repo, "installer", name), "utf-8");
    fs.writeFileSync(path.join(out, name), stamp(script, { version, sourceSha256, nodeHashes: manifest.node.sha256 }));
  }
  const sums = ["source.tar.gz", "install.sh", "install.ps1"].map((f) => `${sha256(path.join(out, f))}  ${f}`).join("\n") + "\n";
  fs.writeFileSync(path.join(out, "SHA256SUMS"), sums);
  console.log(`Release ${version}, ${files.length} files, in ${out}`);
  console.log(sums.trimEnd());
}

if (require.main === module) main();
module.exports = { stamp };
