// What the app's window may do, and who may call its privileged IPC.
// The preload exposes library, file and credential operations, so only the app's
// own page may ever reach it: not a popup, a navigated-away window or an embed.
const { shell } = require("electron");

let trustedPageUrl = null;

/** Sets the one page allowed to use IPC: the Vite dev server, or the packaged index.html. */
function setTrustedPage(url) {
  trustedPageUrl = url;
}

function withoutHash(url) {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.search = "";
  return parsed.href;
}

function isTrustedUrl(url, trusted = trustedPageUrl) {
  if (!url || !trusted) return false;
  try {
    return withoutHash(url) === withoutHash(trusted);
  } catch {
    return false;
  }
}

/** True only for the top-level frame of the app's own page. */
function isTrustedSender(event, trusted = trustedPageUrl) {
  const frame = event && event.senderFrame;
  if (!frame || frame.parent) return false;
  return isTrustedUrl(frame.url, trusted);
}

function isExternalWebUrl(url) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/** Links open in the user's browser. The app window itself never leaves the app's page. */
function hardenWindow(win) {
  const { webContents } = win;
  webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalWebUrl(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  webContents.on("will-navigate", (event, url) => {
    if (isTrustedUrl(url)) return;
    event.preventDefault();
    if (isExternalWebUrl(url)) shell.openExternal(url);
  });
  webContents.on("will-attach-webview", (event) => event.preventDefault());
}

/**
 * YouTube's player refuses to run without a Referer (error 153), and an installed app's
 * page is a file:// URL, which sends none. YouTube's API terms ask clients to identify
 * themselves this way, so embeds are told plainly which app they're in.
 */
function identifyToYoutubeEmbeds(session, appId) {
  session.webRequest.onBeforeSendHeaders({ urls: ["https://www.youtube.com/embed/*"] }, (details, callback) => {
    callback({ requestHeaders: { ...details.requestHeaders, Referer: `https://${appId}/` } });
  });
}

module.exports = { identifyToYoutubeEmbeds, setTrustedPage, isTrustedUrl, isTrustedSender, isExternalWebUrl, hardenWindow };
