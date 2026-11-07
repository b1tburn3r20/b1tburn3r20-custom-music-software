// A script rather than settings in package.json, so the macOS icon is only used if a usable
// one exists: electron-builder fails the whole build on a missing or too-small image.
const path = require("path");
const { macIconFile } = require("./electron/lib/appIcon.cjs");

const macIcon = macIconFile(path.join(__dirname, "public"));

module.exports = {
  appId: "com.b1tburn3r20.app",
  productName: "b1tburn3r20",
  npmRebuild: false,
  files: ["dist/**/*", "electron/**/*", "handlers/**/*", "shared/**/*", "package.json", "!**/*.test.*", "!**/*.d.mts"],
  directories: { output: "release" },
  // Otherwise the program is named after package.json, and the installer and smoke test can't find it.
  linux: { target: ["dir"], category: "AudioVideo", executableName: "b1tburn3r20" },
  // Editing the .exe makes electron-builder fetch winCodeSign, whose archive contains symlinks
  // that a normal Windows user can't create. So the .exe keeps Electron's icon; the window
  // and the Start Menu shortcut set their own instead.
  win: { target: ["dir"], signAndEditExecutable: false },
  mac: {
    target: ["dir"],
    category: "public.app-category.music",
    ...(macIcon ? { icon: macIcon } : {}),
    // The installer signs the finished app itself (ad hoc), since there's no identity on a user's Mac.
    ...(process.env.B1T_MAC_UNSIGNED ? { identity: null } : {}),
  },
};
