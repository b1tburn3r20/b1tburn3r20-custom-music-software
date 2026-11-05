# b1tburn3r20

A music player for the music on your computer, with radio, tags, listening stats and audio visualizers. Works on Windows, macOS and Linux.

## Install

One command. It checks your computer, builds the app, tests the build, and adds it to your apps. No admin rights needed.

**Windows** (PowerShell):

```powershell
irm https://github.com/b1tburn3r20/b1tburn3r20-custom-music-software/releases/latest/download/install.ps1 | iex
```

**macOS and Linux**:

```sh
curl -fsSL https://github.com/b1tburn3r20/b1tburn3r20-custom-music-software/releases/latest/download/install.sh | sh
```

You need about 2 GB free while it builds, and it takes a few minutes. Your own Node, if you have one, isn't used or changed. On Linux, if libraries Electron needs are missing, it tells you the exact command and asks first. It installs only those packages and never upgrades your system.

### Options

| What | macOS and Linux | Windows |
|---|---|---|
| Check only, change nothing | `sh -s -- --check-only` | `$env:B1T_CHECK_ONLY=1` |
| Don't ask questions | `sh -s -- --yes` | `$env:B1T_YES=1` |
| A specific version | `sh -s -- --version 0.2.0` | `$env:B1T_VERSION="0.2.0"` |
| Uninstall | `sh -s -- --uninstall` | `$env:B1T_UNINSTALL=1` |

On Windows, set the variable first, then run the install command. Running the installer again upgrades the app. Uninstalling never touches your music, and asks before removing your playlists and likes.

## Your music

The app uses your computer's Music folder, so there's nothing to set up. Put MP3 files directly in that folder, not in folders inside it, or choose a different folder in Settings → Library.

## YouTube is optional

Everything above works without YouTube. To add it, upload a **cookies.txt** file in Netscape format, on the YouTube page or in Settings → YouTube. The app walks you through exporting one. That loads your playlists and liked videos, and lets you download anything your account can watch.

A cookies file can sign in as you, so don't share it. The app keeps only its YouTube and Google cookies, on your computer, and uses them only to talk to YouTube. The file isn't encrypted, because yt-dlp has to read it. Removing it in Settings deletes it.

Under **Other options**:

| | Unlocks | Needs |
|---|---|---|
| **API key** | Searching YouTube | A free key from Google, a few minutes |
| **Your own Google client** | Read-only access to your playlists, likes and subscriptions, with no cookies | A Google Cloud project, about ten minutes |
| **Your browser's sign-in** | The same as a cookies file, read directly from your browser | Works best with Firefox |

Keys and Google sign-in are encrypted on your computer using your system's own protection, and nothing is kept in this repo. On Linux with no keyring, the app says so, and keeps them only until you close the app unless you choose otherwise. Google sign-in can't post, change your account, see your password, or read your watch history. Its data is deleted if it isn't refreshed within 30 days, and disconnecting revokes access at Google. Google will warn you that the app isn't verified, which is expected for your own project.

When a new yt-dlp is out, the app offers to update it. That replaces one file in the app's own folder, so it never needs a system upgrade.

## AI tagging is optional too

In Settings → AI tagging, add your own Claude or OpenAI API key and pick a model: Low, Medium or High, with a rough idea of how many songs $1 covers. The app then tags only songs with no tags, choosing from its tag list, and never changes songs you've tagged. It sends each song's title, artist, album and genre to that provider, and nothing else. Keys are encrypted on your computer, and your provider bills you directly.

## Development

```sh
npm ci             # Node 22.12 or newer. CI tests 22, 24 and 26
npm run dev:electron
```

| Command | What it does |
|---|---|
| `npm test` | Unit tests |
| `npm run test:e2e` | Builds the app and drives it with a fake Google |
| `npm run typecheck`, `npm run lint` | Static checks |
| `npm run electron:pack` | Packages for this OS, into `release/` |
| `npm run smoke` | Checks that a packaged build really works |
| `node scripts/make-release.cjs out --worktree` | Builds release files from your working tree |

To test the installer without a release, build release files, then set `B1T_SOURCE_TARBALL` to `out/source.tar.gz` and `B1T_INSTALL_ROOT` to a throwaway folder before running `out/install.sh` or `out/install.ps1`.

### Themes

Every CSS file in `src/themes/` becomes a theme, listed in Settings → Appearance. To add one, copy a theme's CSS from [tweakcn](https://tweakcn.com) and save it as `src/themes/<name>.css`. A file with both `:root` and `.dark` blocks gives a light and a dark version. Fonts only apply if they're installed.

Every theme also gets depth colors: use `bg-background-dark` for recessed areas and `bg-background-light` for raised ones. They're worked out from the theme's background, or a theme can set `--background-dark` and `--background-light` itself.

### Icons

Put these in `public/`. Both are optional:

| File | Used for | Without it |
|---|---|---|
| `public/icon.png` | macOS app icon, Linux launcher, the window on macOS and Linux. At least 512x512 for macOS | Default Electron icon (macOS), bundled image (Linux launcher) |
| `public/favicon.ico` | Windows Start Menu shortcut, Apps list, window and taskbar | `icon.png` for the window, default Electron icon for the shortcut |

A missing or unusable image never stops a build. They take effect the next time the app is built. The Windows `.exe` file itself keeps Electron's icon, because changing it needs a tool that normal Windows users can't run.

### Releasing

Bump `version` in `package.json`, then push a tag such as `v0.2.0`. The release workflow publishes the source and the install scripts, with every hash filled in.

### Updating the pinned tools

Installs use their own pinned Node, separate from the Node you develop with. Node and ffmpeg are pinned in `installer/tools-manifest.json`. The Node version and hash placeholders also appear in `installer/install.sh` and `installer/install.ps1`, and a test fails if they disagree.
