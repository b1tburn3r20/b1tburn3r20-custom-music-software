// The app's icons: public/icon.png and public/favicon.ico. Both are optional, and each use
// falls back rather than failing, so a missing or unusable image can never stop a build.
const fs = require("fs");
const path = require("path");

const ICON_PNG = "icon.png";
const ICON_ICO = "favicon.ico";
const FALLBACK_SVG = "images/LilWhiteGuy(2).svg";
const MAC_MIN_SIZE = 512; // electron-builder fails on anything smaller when making the macOS icon

/** Window and taskbar icon. Electron only reads .ico files on Windows. */
function windowIconFiles(platform = process.platform) {
  return platform === "win32" ? [ICON_ICO, ICON_PNG] : [ICON_PNG];
}

/** The in-app favicon: a path relative to the page, and always something that exists. */
function faviconFile(exists) {
  if (exists(ICON_ICO)) return { href: `./${ICON_ICO}`, type: "image/x-icon" };
  if (exists(ICON_PNG)) return { href: `./${ICON_PNG}`, type: "image/png" };
  return { href: `./${FALLBACK_SVG}`, type: "image/svg+xml" };
}

/** Width and height from a PNG's header, or null if this isn't a PNG. */
function pngSize(buffer) {
  const signature = "89504e470d0a1a0a";
  if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== signature) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/** The file to build the macOS app icon from, or null to keep Electron's default. */
function macIconFile(publicDir, { warn = console.warn } = {}) {
  const file = path.join(publicDir, ICON_PNG);
  let buffer;
  try {
    buffer = fs.readFileSync(file);
  } catch {
    return null;
  }
  const size = pngSize(buffer);
  if (!size) {
    warn(`[icon] ${ICON_PNG} isn't a valid PNG, so the macOS app keeps the default icon.`);
    return null;
  }
  if (size.width < MAC_MIN_SIZE || size.height < MAC_MIN_SIZE) {
    warn(`[icon] ${ICON_PNG} is ${size.width}x${size.height}. macOS needs at least ${MAC_MIN_SIZE}x${MAC_MIN_SIZE}, so the macOS app keeps the default icon.`);
    return null;
  }
  return file;
}

/** The icon a Linux launcher should show, and the name to install it under. */
function linuxIconFile(publicDir, exists = fs.existsSync) {
  const png = path.join(publicDir, ICON_PNG);
  if (exists(png)) return { source: png, name: "icon.png" };
  const svg = path.join(publicDir, FALLBACK_SVG);
  if (exists(svg)) return { source: svg, name: "icon.svg" };
  return null;
}

/** The icon for a Windows Start Menu shortcut, which can only be an .ico file. */
function windowsShortcutIcon(publicDir, exists = fs.existsSync) {
  const ico = path.join(publicDir, ICON_ICO);
  return exists(ico) ? ico : null;
}

module.exports = { ICON_PNG, ICON_ICO, FALLBACK_SVG, MAC_MIN_SIZE, windowIconFiles, faviconFile, pngSize, macIconFile, linuxIconFile, windowsShortcutIcon };
