const { app } = require("electron");
const { handle, broadcast } = require("../ipc.cjs");
const { createAiTagger } = require("./aiTagger.cjs");

/** For tests against a fake provider. Ignored in an installed app, so keys can't be redirected. */
function testEndpoints() {
  if (app.isPackaged || !process.env.B1T_AI_ENDPOINTS) return {};
  return JSON.parse(process.env.B1T_AI_ENDPOINTS);
}

function registerAiIpc({ library, user, credentials }) {
  const tagger = createAiTagger({
    credentials,
    songs: () => library.visibleSongs(),
    tagsOf: (id) => user.snapshot().songTags[id] || [],
    applyTags: (id, tags) => user.setSongTags([id], tags),
    settings: () => user.settings,
    emit: (progress) => broadcast("ai:progress", progress),
    endpoints: testEndpoints(),
  });
  handle("ai:status", () => tagger.status());
  handle("ai:set-key", async (provider, key, opts = {}) => {
    const { persisted } = await tagger.setKey(provider, key, { allowWeak: Boolean(opts.allowWeak) });
    return { persisted };
  });
  handle("ai:remove-key", async (provider) => {
    await tagger.removeKey(provider);
    return null;
  });
  handle("ai:start", (opts) => tagger.start(opts || {}));
  handle("ai:cancel", () => tagger.cancel());
}

module.exports = { registerAiIpc };
