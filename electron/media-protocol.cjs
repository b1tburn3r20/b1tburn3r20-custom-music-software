// media://song/<id> and media://thumb/<id>
// Serves audio and artwork by song id only (no arbitrary paths), with HTTP
// Range support so seeking works. This replaces file:// URLs, which required
// running the renderer with webSecurity disabled.
const { protocol } = require("electron");
const fs = require("fs");
const { Readable } = require("stream");

const SCHEME = "media";

function registerMediaScheme() {
  protocol.registerSchemesAsPrivileged([
    { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
  ]);
}

const MIME = { mp3: "audio/mpeg", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

function notFound() {
  return new Response("Not found", { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
}

function serveFile(filePath, request, contentType) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return notFound();
  }
  const size = stat.size;
  const base = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
  };
  const range = request.headers.get("range");
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (m) {
    let start = m[1] === "" ? null : Number(m[1]);
    let end = m[2] === "" ? null : Number(m[2]);
    if (start === null) {
      start = Math.max(0, size - (end || 0));
      end = size - 1;
    } else if (end === null || end >= size) end = size - 1;
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${size}` } });
    }
    const stream = fs.createReadStream(filePath, { start, end });
    return new Response(Readable.toWeb(stream), {
      status: 206,
      headers: { ...base, "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${size}` },
    });
  }
  return new Response(Readable.toWeb(fs.createReadStream(filePath)), {
    status: 200,
    headers: { ...base, "Content-Length": String(size) },
  });
}

function handleMediaProtocol(library) {
  protocol.handle(SCHEME, async (request) => {
    try {
      const url = new URL(request.url);
      const kind = url.hostname;
      const id = decodeURIComponent(url.pathname.replace(/^\//, ""));
      if (kind === "song") {
        const song = library.getSong(id);
        if (!song) return notFound();
        const ext = song.path.split(".").pop().toLowerCase();
        return serveFile(song.path, request, MIME[ext] || "application/octet-stream");
      }
      if (kind === "thumb") {
        const p = await library.thumbnailFor(id);
        if (!p) return notFound();
        const ext = p.split(".").pop().toLowerCase();
        return serveFile(p, request, MIME[ext] || "image/jpeg");
      }
      return notFound();
    } catch (err) {
      console.error("[media] request failed:", err.message);
      return new Response("Error", { status: 500 });
    }
  });
}

module.exports = { registerMediaScheme, handleMediaProtocol };
