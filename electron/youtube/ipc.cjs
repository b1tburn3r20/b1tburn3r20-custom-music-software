const { handle, broadcast } = require("../ipc.cjs");
const { createYoutubeService } = require("./service.cjs");
const { createDownloadManager } = require("./downloads.cjs");

function registerYoutubeIpc({ library, user, userData }) {
  const youtube = createYoutubeService({ user, userData });
  const downloads = createDownloadManager({ library, user, youtube, emit: (item) => broadcast("youtube:download-update", item) });

  handle("youtube:auth-status", () => youtube.status());
  handle("youtube:set-auth", (patch) => youtube.setAuth(patch || {}));
  handle("youtube:import-cookies", () => youtube.importCookiesFile());
  handle("youtube:remove-cookies", () => youtube.removeCookiesFile());
  handle("youtube:check-auth", () => youtube.checkAuth());
  handle("youtube:my-playlists", () => youtube.myPlaylists());
  handle("youtube:playlist-items", (id) => youtube.playlistItems(id));

  handle("youtube:enqueue", (videos, opts = {}) => {
    let target = null;
    if (opts.mirror && opts.mirror.youtubeId) target = user.ensureMirrorPlaylist(String(opts.mirror.youtubeId), String(opts.mirror.title || ""));
    else if (opts.playlistId) target = { id: String(opts.playlistId) };
    return { items: downloads.enqueue(videos || [], { target: target ? { id: target.id } : null }), playlistId: target ? target.id : null };
  });
  handle("youtube:downloads", () => downloads.list());
  handle("youtube:cancel", (videoId) => (videoId ? downloads.cancel(videoId) : downloads.cancelAll()));
  handle("youtube:clear-finished", () => downloads.clearFinished());
  // Single download that resolves when finished (used by search results).
  handle("youtube:download", async ({ videoId, title }) => {
    downloads.enqueue([{ videoId, title }]);
    const item = await downloads.waitFor(videoId);
    if (item.status === "error") throw Object.assign(new Error(item.error.message), { code: item.error.code });
    if (item.status === "cancelled") throw Object.assign(new Error("Download cancelled"), { code: "CANCELLED" });
    return { songId: item.songId, alreadyHad: item.status === "skipped" };
  });
  return { youtube, downloads };
}

module.exports = { registerYoutubeIpc };
