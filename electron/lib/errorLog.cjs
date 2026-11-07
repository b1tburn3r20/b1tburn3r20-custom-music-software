// Keeps errors and warnings from the whole app in logs/errors.log in the data folder, so a
// problem can still be looked into after the app has closed. It stays on this computer.
const fs = require("fs");
const os = require("os");
const path = require("path");

const MAX_BYTES = 1024 * 1024;
const MAX_ENTRY = 4000;
const REPEAT_WINDOW_MS = 60 * 1000;

const SECRETS = [
  [/\bAIza[\w-]{20,}/g, "<api-key>"],
  [/\bsk-[\w-]{16,}/g, "<api-key>"],
  [/\bya29\.[\w.-]+/g, "<token>"],
  [/\bBearer\s+[\w.~+/=-]+/gi, "Bearer <token>"],
  [/\b(api[_-]?key|x-api-key|key|access_token|refresh_token|id_token|token|client_secret|secret|password|authorization|cookies?|sapisid|apisid)(["']?\s*[=:]\s*["']?)[^\s"'&,;]+/gi, "$1$2<redacted>"],
];

/** Takes out anything shaped like a credential, in case one ends up in an error message. */
function redact(text) {
  return SECRETS.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), String(text));
}

function describe(value) {
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function createErrorLog(file, { now = () => Date.now(), maxBytes = MAX_BYTES } = {}) {
  const recent = new Map();
  const append = (line) => {
    // Written straight away, so the last thing before a crash isn't lost. A log must never cause an error of its own.
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
      if (size > maxBytes) fs.renameSync(file, `${file}.old`);
      fs.appendFileSync(file, `${line}\n`, "utf-8");
    } catch {
      /* nowhere left to report it */
    }
  };

  function record(source, ...parts) {
    const text = redact(parts.map(describe).join(" ")).slice(0, MAX_ENTRY);
    // Something failing every frame shouldn't bury everything else.
    const key = `${source} ${text}`;
    const at = now();
    if (at - (recent.get(key) ?? -Infinity) < REPEAT_WINDOW_MS) return;
    recent.set(key, at);
    if (recent.size > 200) recent.delete(recent.keys().next().value);
    append(`${new Date(at).toISOString()} [${source}] ${text}`);
  }

  /** What's needed to make sense of a log from someone else's computer. */
  function start(appVersion) {
    append(`\n${new Date(now()).toISOString()} === started ${appVersion} on ${process.platform} ${os.release()} ${process.arch}, Electron ${process.versions.electron || "?"}, ${os.cpus().length} CPUs, ${Math.round(os.totalmem() / 2 ** 30)} GB RAM`);
  }

  /** Everything the main process warns about or fails on. It still goes to the console too. */
  function captureProcess(proc = process, con = console) {
    for (const [method, source] of [["error", "main error"], ["warn", "main warning"]]) {
      const original = con[method].bind(con);
      con[method] = (...args) => {
        record(source, ...args);
        original(...args);
      };
    }
    proc.on("uncaughtExceptionMonitor", (err) => record("main crash", err));
    proc.on("unhandledRejection", (reason) => record("main unhandled", reason));
  }

  /** The page's errors, and the page itself going down. */
  function watchWindow(win) {
    const page = win.webContents;
    page.on("console-message", (details) => {
      if (details.level !== "error" && details.level !== "warning") return;
      if (/Electron Security Warning/.test(details.message)) return;
      record(details.level === "error" ? "page error" : "page warning", `${details.message} (${path.basename(String(details.sourceId || ""))}:${details.lineNumber})`);
    });
    page.on("render-process-gone", (_event, details) => record("page crash", details));
    page.on("did-fail-load", (_event, code, description, url, isMainFrame) => {
      if (isMainFrame) record("page load failed", `${description} (${code}) ${url}`);
    });
    win.on("unresponsive", () => record("page frozen", "The window stopped responding."));
  }

  return { file, dir: path.dirname(file), record, start, captureProcess, watchWindow };
}

module.exports = { createErrorLog, redact };
