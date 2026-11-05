#!/bin/sh
# b1tburn3r20 installer for macOS and Linux. Needs no admin rights unless your system is
# missing libraries Electron needs, and then it asks first. It never upgrades your system.
#
#   curl -fsSL https://github.com/b1tburn3r20/b1tburn3r20-custom-music-software/releases/latest/download/install.sh | sh
#
# Options:  curl ... | sh -s -- --check-only
#   --check-only   Report what's missing, and stop.
#   --yes          Don't ask questions (missing libraries are then only reported).
#   --version X    Install a specific version.
#   --force        Allow installing an older version.
#   --no-launch    Don't offer to open the app afterwards.
#   --uninstall    Remove the app.

# Everything is inside main(), called on the last line, so a download cut off halfway
# runs nothing at all instead of part of the script.
main() {
  set -eu

  # Stamped at release time. Everything downloaded is checked against these.
  RELEASE_VERSION="__B1T_VERSION__"
  SOURCE_SHA256="__B1T_SOURCE_SHA256__"
  REPO="https://github.com/b1tburn3r20/b1tburn3r20-custom-music-software"
  NODE_VERSION="26.13.0"
  MIN_FREE_GB=2

  CHECK_ONLY=0 YES=0 FORCE=0 UNINSTALL=0 NO_LAUNCH=0 WANT_VERSION=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --check-only) CHECK_ONLY=1 ;;
      --yes) YES=1 ;;
      --force) FORCE=1 ;;
      --uninstall) UNINSTALL=1 ;;
      --no-launch) NO_LAUNCH=1 ;;
      --version) shift; WANT_VERSION="${1:-}" ;;
      *) die "Unknown option: $1" ;;
    esac
    shift
  done

  OS=$(uname -s)
  case "$OS" in
    Darwin) PLATFORM=darwin; DEFAULT_ROOT="$HOME/Library/Application Support/b1tburn3r20-install" ;;
    Linux) PLATFORM=linux; DEFAULT_ROOT="${XDG_DATA_HOME:-$HOME/.local/share}/b1tburn3r20" ;;
    *) die "This script is for macOS and Linux. On Windows, use install.ps1 (see the README)." ;;
  esac
  ROOT="${B1T_INSTALL_ROOT:-$DEFAULT_ROOT}"

  case "$(uname -m)" in
    x86_64 | amd64) ARCH=x64 ;;
    arm64 | aarch64) ARCH=arm64 ;;
    *) die "This app needs a 64-bit Intel/AMD or ARM processor (found $(uname -m))." ;;
  esac

  if [ "$UNINSTALL" = 1 ]; then
    run_uninstall
    return
  fi

  preflight
  if [ "$CHECK_ONLY" = 1 ]; then
    echo
    echo "Everything needed is here. Nothing was changed."
    return
  fi

  echo
  echo "This installs b1tburn3r20 to $ROOT. Your music is not touched."
  confirm "Continue?" yes || {
    echo "Cancelled. Nothing was changed."
    return
  }

  mkdir -p "$ROOT"
  WORK="$ROOT/install-tmp"
  rm -rf "$WORK"
  mkdir -p "$WORK"
  trap 'rm -rf "$WORK"' EXIT

  fetch_source
  fetch_node

  set -- "$WORK/source/installer/install-core.cjs" --source "$WORK/source" --root "$ROOT"
  [ "$YES" = 1 ] && set -- "$@" --yes
  [ "$FORCE" = 1 ] && set -- "$@" --force
  [ "$NO_LAUNCH" = 1 ] && set -- "$@" --no-launch
  if [ -r /dev/tty ] && [ -w /dev/tty ] && [ "$YES" = 0 ] && (: </dev/tty) 2>/dev/null; then
    "$NODE_BIN" "$@" </dev/tty
  else
    "$NODE_BIN" "$@"
  fi
}

die() {
  printf '\nInstall stopped: %s\nYour existing install, music and data were not changed.\n' "$1" >&2
  exit 1
}

# `curl | sh` uses stdin for the script itself, so questions are read from the terminal.
confirm() {
  if [ "$YES" = 1 ]; then
    [ "$2" = yes ]
    return
  fi
  if ! (: </dev/tty) 2>/dev/null; then
    [ "$2" = yes ]
    return
  fi
  if [ "$2" = yes ]; then hint="[Y/n]"; else hint="[y/N]"; fi
  printf '%s %s ' "$1" "$hint" >/dev/tty
  read -r reply </dev/tty || reply=""
  case "$reply" in
    "") [ "$2" = yes ] ;;
    y | Y | yes | YES) return 0 ;;
    *) return 1 ;;
  esac
}

check() {
  # check <ok|FAIL> <label> <detail>
  printf '  [%-4s] %-16s %s\n' "$1" "$2" "$3"
  [ "$1" = ok ] || PREFLIGHT_OK=0
}

# version_at_least <a.b.c> <major> <minor>
version_at_least() {
  have_major=$(echo "$1" | cut -d. -f1)
  have_minor=$(echo "$1" | cut -d. -f2)
  [ "${have_major:-0}" -gt "$2" ] || { [ "${have_major:-0}" -eq "$2" ] && [ "${have_minor:-0}" -ge "$3" ]; }
}

reachable() {
  curl -sS -o /dev/null --max-time 15 -I "$1" 2>/dev/null
}

free_gb() {
  # The nearest folder that already exists, since the install folder may not yet.
  dir="$ROOT"
  while [ ! -d "$dir" ]; do dir=$(dirname "$dir"); done
  df -Pk "$dir" | awk 'NR==2 { print int($4 / 1048576) }'
}

# Libraries Electron needs on Linux: <file to look for> <apt> <dnf> <pacman> <zypper>
LINUX_LIBS="
libnss3.so libnss3 nss nss mozilla-nss
libatk-bridge-2.0.so.0 libatk-bridge2.0-0 at-spi2-atk at-spi2-core libatk-bridge-2_0-0
libcups.so.2 libcups2 cups-libs libcups libcups2
libgtk-3.so.0 libgtk-3-0 gtk3 gtk3 libgtk-3-0
libgbm.so.1 libgbm1 mesa-libgbm mesa libgbm1
libasound.so.2 libasound2 alsa-lib alsa-lib libasound2
libxkbcommon.so.0 libxkbcommon0 libxkbcommon libxkbcommon libxkbcommon0
libXcomposite.so.1 libxcomposite1 libXcomposite libxcomposite libXcomposite1
libXdamage.so.1 libxdamage1 libXdamage libxdamage libXdamage1
libXrandr.so.2 libxrandr2 libXrandr libxrandr libXrandr2
"

linux_package_manager() {
  for pm in apt-get dnf pacman zypper; do
    if command -v "$pm" >/dev/null 2>&1; then
      echo "$pm"
      return
    fi
  done
}

has_library() {
  if command -v ldconfig >/dev/null 2>&1; then
    ldconfig -p 2>/dev/null | grep -q "$1" && return 0
  elif [ -x /sbin/ldconfig ]; then
    /sbin/ldconfig -p 2>/dev/null | grep -q "$1" && return 0
  fi
  for dir in /usr/lib /usr/lib64 /usr/lib/x86_64-linux-gnu /usr/lib/aarch64-linux-gnu /lib /lib64; do
    [ -e "$dir/$1" ] && return 0
  done
  return 1
}

# Only the packages that are missing. Never `pacman -Syu`, `apt upgrade` or anything like
# them: a partial upgrade can break a system, and this app has no business doing one.
install_command() {
  case "$1" in
    apt-get) echo "sudo apt-get update && sudo apt-get install -y $2" ;;
    dnf) echo "sudo dnf install -y $2" ;;
    pacman) echo "sudo pacman -S --needed $2" ;;
    zypper) echo "sudo zypper install -y $2" ;;
  esac
}

check_linux_libraries() {
  pm=$(linux_package_manager)
  case "$pm" in
    apt-get) column=2 ;;
    dnf) column=3 ;;
    pacman) column=4 ;;
    zypper) column=5 ;;
    *) column=2 ;;
  esac
  missing_files="" missing_packages=""
  while read -r line; do
    [ -n "$line" ] || continue
    file=$(echo "$line" | awk '{ print $1 }')
    if ! has_library "$file"; then
      missing_files="$missing_files $file"
      package=$(echo "$line" | awk -v c="$column" '{ print $c }')
      case " $missing_packages " in
        *" $package "*) ;;
        *) missing_packages="$missing_packages $package" ;;
      esac
    fi
  done <<EOF
$LINUX_LIBS
EOF
  if [ -z "$missing_files" ]; then
    check ok "Libraries" "everything Electron needs is present"
    return
  fi
  missing_packages=${missing_packages# }
  if [ -z "$pm" ]; then
    check FAIL "Libraries" "missing:$missing_files. Install them with your package manager."
    return
  fi
  command=$(install_command "$pm" "$missing_packages")
  echo "  This system is missing libraries Electron needs: $missing_packages"
  echo "  To install only those, this would run:"
  echo "    $command"
  if [ "$CHECK_ONLY" = 0 ] && confirm "  Run that now?" no && sh -c "$command"; then
    check ok "Libraries" "installed"
  else
    check FAIL "Libraries" "run the command above, then run this again"
  fi
}

preflight() {
  PREFLIGHT_OK=1
  echo "Checking this computer:"
  if [ "$PLATFORM" = darwin ]; then
    version=$(sw_vers -productVersion)
    # Node sets this limit, not Electron, whose own minimum is lower.
    if version_at_least "$version" 13 5; then check ok "macOS" "$version"; else check FAIL "macOS" "$version (needs macOS 13.5 or newer)"; fi
  else
    check ok "Linux" "$(uname -r)"
    glibc=$(getconf GNU_LIBC_VERSION 2>/dev/null | awk '{ print $2 }')
    if [ -z "$glibc" ]; then
      check FAIL "glibc" "not found. This app needs a Linux that uses glibc 2.28 or newer."
    elif version_at_least "$glibc" 2 28; then
      check ok "glibc" "$glibc"
    else
      check FAIL "glibc" "$glibc (needs 2.28 or newer, such as Ubuntu 20.04 or later)"
    fi
  fi
  check ok "Architecture" "$ARCH"
  for tool in curl tar df awk; do
    if command -v "$tool" >/dev/null 2>&1; then
      check ok "$tool" "found"
    else
      check FAIL "$tool" "not found. Install it with your package manager."
    fi
  done
  free=$(free_gb)
  if [ "$free" -ge "$MIN_FREE_GB" ]; then
    check ok "Disk space" "$free GB free (needs $MIN_FREE_GB GB while building)"
  else
    check FAIL "Disk space" "$free GB free (needs $MIN_FREE_GB GB while building)"
  fi
  for site in https://github.com https://nodejs.org https://registry.npmjs.org; do
    if reachable "$site"; then check ok "Network" "$site"; else check FAIL "Network" "can't reach $site"; fi
  done
  [ "$PLATFORM" = linux ] && check_linux_libraries

  echo
  echo "Installed automatically, just for this app:"
  echo "  - Node $NODE_VERSION, used to build the app (your own Node isn't used or changed)"
  echo "  - yt-dlp and ffmpeg, used for optional YouTube features"
  if command -v adb >/dev/null 2>&1; then
    echo "Optional: adb found, so phone sync can work."
  else
    echo "Optional: adb not found. Only phone sync needs it: install Android Platform Tools if you want that."
  fi
  [ "$PREFLIGHT_OK" = 1 ] || die "This computer isn't ready yet. Fix the items marked FAIL above, then run this again."
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{ print $1 }'
  else
    shasum -a 256 "$1" | awk '{ print $1 }'
  fi
}

assert_hash() {
  actual=$(sha256_of "$1")
  [ "$actual" = "$2" ] || die "$3 failed its checksum, so nothing was installed. Try again; if it keeps happening, please report it."
}

fetch_source() {
  tarball="$WORK/source.tar.gz"
  if [ -n "${B1T_SOURCE_TARBALL:-}" ]; then
    # Testing a build that hasn't been released yet.
    cp "$B1T_SOURCE_TARBALL" "$tarball"
  else
    case "$RELEASE_VERSION" in __*) stamped=0 ;; *) stamped=1 ;; esac
    if [ "$stamped" = 0 ] && [ -z "$WANT_VERSION" ]; then
      die "This copy of the script wasn't made by a release. Use the command in the README, or pass --version."
    fi
    tag="${WANT_VERSION:-$RELEASE_VERSION}"
    base="$REPO/releases/download/v$tag"
    echo "Downloading version $tag..."
    curl -fsSL "$base/source.tar.gz" -o "$tarball" || die "Couldn't download version $tag."
    if [ "$stamped" = 1 ] && [ "$tag" = "$RELEASE_VERSION" ]; then
      assert_hash "$tarball" "$SOURCE_SHA256" "The download"
    else
      curl -fsSL "$base/SHA256SUMS" -o "$WORK/SHA256SUMS" || die "Couldn't download the checksums for version $tag."
      expected=$(awk '$2 == "source.tar.gz" { print $1 }' "$WORK/SHA256SUMS")
      [ -n "$expected" ] || die "Release $tag doesn't list a checksum for its source."
      assert_hash "$tarball" "$expected" "The download"
    fi
  fi
  mkdir -p "$WORK/source"
  tar -xzf "$tarball" -C "$WORK/source" || die "Couldn't unpack the download."
}

fetch_node() {
  case "$PLATFORM-$ARCH" in
    darwin-arm64) sha="__NODE_SHA_darwin-arm64__" ;;
    darwin-x64) sha="__NODE_SHA_darwin-x64__" ;;
    linux-x64) sha="__NODE_SHA_linux-x64__" ;;
    linux-arm64) sha="__NODE_SHA_linux-arm64__" ;;
  esac
  name="node-v$NODE_VERSION-$PLATFORM-$ARCH"
  echo "Downloading Node $NODE_VERSION..."
  curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/$name.tar.gz" -o "$WORK/node.tar.gz" || die "Couldn't download Node."
  assert_hash "$WORK/node.tar.gz" "$sha" "The Node download"
  tar -xzf "$WORK/node.tar.gz" -C "$WORK" || die "Couldn't unpack Node."
  NODE_BIN="$WORK/$name/bin/node"
}

run_uninstall() {
  node_bin="$ROOT/tools/node"
  core="$ROOT/installer/install-core.cjs"
  [ -x "$node_bin" ] && [ -f "$core" ] || die "b1tburn3r20 doesn't seem to be installed in $ROOT."
  if [ "$YES" = 1 ]; then
    "$node_bin" "$core" --root "$ROOT" --uninstall --yes
  elif (: </dev/tty) 2>/dev/null; then
    "$node_bin" "$core" --root "$ROOT" --uninstall </dev/tty
  else
    "$node_bin" "$core" --root "$ROOT" --uninstall
  fi
}

main "$@"
