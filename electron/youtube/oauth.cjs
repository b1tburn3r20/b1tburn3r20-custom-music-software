// Google sign-in for the user's own account, using the Desktop client they created.
// Main process only: tokens never reach the renderer.
//
// Follows Google's guidance for desktop apps: the system browser (never an embedded view),
// a loopback redirect on a random port, PKCE S256, and a random `state`. Only the read-only
// YouTube scope is requested.
const crypto = require("crypto");
const http = require("http");
const { YtError } = require("./ytdlp.cjs");

const SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
const DEFAULT_ENDPOINTS = {
  auth: "https://accounts.google.com/o/oauth2/v2/auth",
  token: "https://oauth2.googleapis.com/token",
  revoke: "https://oauth2.googleapis.com/revoke",
};
const CONNECT_TIMEOUT_MS = 5 * 60 * 1000;
const EXPIRY_MARGIN_MS = 60 * 1000;
const CLIENT_ID_RE = /^[A-Za-z0-9_.-]+\.apps\.googleusercontent\.com$/;

// Static on purpose: nothing from the request is ever written into these pages.
const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;text-align:center"><h1 style="font-size:1.4rem">${title}</h1><p>${body}</p></body></html>`;
const PAGES = {
  done: page("You're connected", "You can close this tab and go back to the app."),
  denied: page("Nothing was connected", "You can close this tab. The app works fine without this, and you can try again any time."),
  invalid: page("That didn't work", "This link wasn't expected. Please start again from the app."),
};

const base64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function createPkce() {
  const verifier = base64url(crypto.randomBytes(32));
  return { verifier, challenge: base64url(crypto.createHash("sha256").update(verifier).digest()) };
}

/** Accepts Google's downloaded JSON, or an ID and secret typed in separately. */
function parseClient(input) {
  let clientId;
  let clientSecret;
  if (typeof input === "string") {
    let json;
    try {
      json = JSON.parse(input);
    } catch {
      throw new YtError("CLIENT_INVALID", "That file isn't the JSON that Google provides for a client.");
    }
    if (json.web && !json.installed) throw new YtError("CLIENT_WRONG_TYPE", "That client's type is “Web application”. Create one with the type “Desktop app”.");
    const c = json.installed || {};
    clientId = c.client_id;
    clientSecret = c.client_secret;
  } else {
    clientId = input && input.clientId;
    clientSecret = input && input.clientSecret;
  }
  clientId = String(clientId || "").trim();
  clientSecret = String(clientSecret || "").trim();
  if (!CLIENT_ID_RE.test(clientId)) throw new YtError("CLIENT_INVALID", "That doesn't look like a client ID. It should end in .apps.googleusercontent.com.");
  return { clientId, clientSecret };
}

function createGoogleAuth({ credentials, openExternal, fetchFn = fetch, endpoints = DEFAULT_ENDPOINTS, timeoutMs = CONNECT_TIMEOUT_MS, now = Date.now, onChange = () => {} }) {
  let access = null; // { token, expiresAt }. Memory only, by design.
  let needsReconnect = false;
  let refreshing = null;
  let activeConnect = null;

  const client = async () => {
    const stored = await credentials.get("oauthClient");
    return stored ? JSON.parse(stored) : null;
  };
  const refreshToken = async () => {
    const stored = await credentials.get("oauthToken");
    return stored ? JSON.parse(stored).refreshToken : null;
  };

  async function status() {
    return { hasClient: (await client()) !== null, connected: (await refreshToken()) !== null, needsReconnect };
  }

  async function setClient(input, { allowWeak = false } = {}) {
    const parsed = parseClient(input);
    const previous = await client();
    // A token only works with the client that issued it.
    if (previous && previous.clientId !== parsed.clientId) await forgetTokens();
    const result = await credentials.set("oauthClient", JSON.stringify(parsed), { allowWeak });
    return { persisted: result.persisted };
  }

  async function forgetTokens() {
    access = null;
    await credentials.remove("oauthToken");
  }

  async function postForm(url, params) {
    let res;
    try {
      res = await fetchFn(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params).toString() });
    } catch {
      throw new YtError("NETWORK", "Couldn't reach Google. Check your internet connection.");
    }
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  }

  function storeAccess(body) {
    access = { token: body.access_token, expiresAt: now() + (Number(body.expires_in) || 3600) * 1000 };
  }

  async function exchangeCode({ code, verifier, redirectUri, allowWeak }) {
    const c = await client();
    const params = { client_id: c.clientId, code, code_verifier: verifier, grant_type: "authorization_code", redirect_uri: redirectUri };
    if (c.clientSecret) params.client_secret = c.clientSecret;
    const { ok, body } = await postForm(endpoints.token, params);
    if (!ok || !body.access_token) throw new YtError("CONNECT_FAILED", `Google didn't complete sign-in${body.error_description ? `: ${body.error_description}` : "."}`);
    // On Google's consent screen each permission can be unticked separately.
    const granted = String(body.scope || "").split(/\s+/);
    if (!granted.includes(SCOPE)) throw new YtError("SCOPE_NOT_GRANTED", "You signed in, but didn't allow access to your YouTube data, so nothing was connected. To try again, leave that box ticked.");
    if (!body.refresh_token) throw new YtError("CONNECT_FAILED", "Google didn't provide a long-term sign-in. Please try again.");
    const stored = await credentials.set("oauthToken", JSON.stringify({ refreshToken: body.refresh_token }), { allowWeak });
    storeAccess(body);
    needsReconnect = false;
    return { persisted: stored.persisted };
  }

  /** Opens Google's sign-in in the browser and resolves once the user has finished there. */
  function connect({ allowWeak = false } = {}) {
    if (activeConnect) return activeConnect.promise;
    let settle;
    const promise = new Promise((resolve, reject) => {
      settle = { resolve, reject };
    });
    promise.catch(() => {}); // callers still see the failure; this only stops it counting as unhandled
    const state = base64url(crypto.randomBytes(24));
    const { verifier, challenge } = createPkce();
    let timer = null;
    const server = http.createServer();
    const finish = (fn, value) => {
      if (!activeConnect) return;
      activeConnect = null;
      clearTimeout(timer);
      server.close();
      server.closeAllConnections?.();
      fn(value);
      onChange();
    };
    activeConnect = { promise, cancel: () => finish(settle.reject, new YtError("CONNECT_CANCELLED", "Sign-in was cancelled.")) };

    server.on("request", async (req, res) => {
      const port = server.address() && server.address().port;
      const respond = (statusCode, html) => {
        res.writeHead(statusCode, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'", "Referrer-Policy": "no-referrer" });
        res.end(html);
      };
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      // The Host check stops a web page reaching this listener through DNS rebinding.
      if (req.method !== "GET" || url.pathname !== "/callback" || req.headers.host !== `127.0.0.1:${port}`) return respond(404, PAGES.invalid);
      // A wrong state is someone else's request. Refuse it, and keep waiting for the real one.
      if (url.searchParams.get("state") !== state) return respond(400, PAGES.invalid);
      const error = url.searchParams.get("error");
      if (error) {
        respond(200, PAGES.denied);
        return finish(settle.reject, error === "access_denied" ? new YtError("CONNECT_DENIED", "Access wasn't allowed on Google's page.") : new YtError("CONNECT_FAILED", `Google reported a problem with sign-in (${String(error).slice(0, 60)}).`));
      }
      const code = url.searchParams.get("code");
      if (!code) return respond(400, PAGES.invalid);
      try {
        const result = await exchangeCode({ code, verifier, redirectUri: `http://127.0.0.1:${port}/callback`, allowWeak });
        respond(200, PAGES.done);
        finish(settle.resolve, result);
      } catch (err) {
        respond(200, PAGES.denied);
        finish(settle.reject, err);
      }
    });

    (async () => {
      const c = await client();
      if (!c) throw new YtError("CLIENT_MISSING", "Add your Google client first.");
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      const redirectUri = `http://127.0.0.1:${server.address().port}/callback`;
      const authUrl = `${endpoints.auth}?${new URLSearchParams({ client_id: c.clientId, redirect_uri: redirectUri, response_type: "code", scope: SCOPE, code_challenge: challenge, code_challenge_method: "S256", state, access_type: "offline", prompt: "consent" })}`;
      timer = setTimeout(
        // A disabled client or a reached user limit stops on Google's page and never comes back here.
        () => finish(settle.reject, new YtError("CONNECT_TIMEOUT", "Sign-in didn't finish. If Google showed an error about this app, check your client's settings in Google Cloud Console, then try again.")),
        timeoutMs,
      );
      await openExternal(authUrl);
    })().catch((err) => finish(settle.reject, err));

    return promise;
  }

  function cancelConnect() {
    if (activeConnect) activeConnect.cancel();
  }

  async function refreshAccess() {
    const [c, token] = [await client(), await refreshToken()];
    if (!c || !token) throw new YtError("NOT_CONNECTED", "Connect Google to load your YouTube data.");
    const params = { client_id: c.clientId, refresh_token: token, grant_type: "refresh_token" };
    if (c.clientSecret) params.client_secret = c.clientSecret;
    const { ok, body } = await postForm(endpoints.token, params); // a network failure throws and keeps the token
    if (ok && body.access_token) return storeAccess(body);
    if (body.error === "invalid_grant") {
      await forgetTokens();
      needsReconnect = true;
      onChange();
      throw new YtError("NEEDS_RECONNECT", "Your Google sign-in has ended. Reconnect to keep loading your data. If this happens about every 7 days, your Google project is still in Testing: publish it under Audience in Google Cloud Console.");
    }
    if (body.error === "invalid_client" || body.error === "unauthorized_client" || body.error === "disabled_client") throw new YtError("CLIENT_REJECTED", "Google rejected your client. Check it in Google Cloud Console. Search, downloads and your library still work.");
    throw new YtError("CONNECT_FAILED", `Google couldn't renew your sign-in${body.error ? ` (${String(body.error).slice(0, 60)})` : ""}. Please try again.`);
  }

  /** A current access token. Concurrent callers share one refresh. */
  async function accessToken() {
    if (access && access.expiresAt - now() > EXPIRY_MARGIN_MS) return access.token;
    if (!refreshing) refreshing = refreshAccess().finally(() => (refreshing = null));
    await refreshing;
    return access.token;
  }

  /** Authorized request. A 401 means the token died early, so renew it and retry once. */
  async function authorizedFetch(url) {
    const attempt = async () => fetchFn(url, { headers: { Authorization: `Bearer ${await accessToken()}` } });
    let res;
    try {
      res = await attempt();
      if (res.status === 401) {
        access = null;
        res = await attempt();
      }
    } catch (err) {
      if (err instanceof YtError) throw err;
      throw new YtError("NETWORK", "Couldn't reach YouTube. Check your internet connection.");
    }
    return res;
  }

  /** Always removes the sign-in from this computer, even when Google can't be reached. */
  async function disconnect() {
    const token = await refreshToken();
    let revoked = !token;
    if (token) {
      try {
        const res = await fetchFn(endpoints.revoke, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }).toString() });
        // Google answers 400 for a token that's already invalid, which is just as good.
        revoked = res.ok || res.status === 400;
      } catch {
        revoked = false;
      }
    }
    await forgetTokens();
    needsReconnect = false;
    onChange();
    return { revoked };
  }

  /** Forgets the client too, so setup starts again from nothing. */
  async function removeClient() {
    const result = await disconnect();
    await credentials.remove("oauthClient");
    onChange();
    return result;
  }

  return { status, setClient, connect, cancelConnect, accessToken, authorizedFetch, disconnect, removeClient };
}

module.exports = { createGoogleAuth, parseClient, createPkce, SCOPE };
