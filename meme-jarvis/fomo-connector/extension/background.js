/**
 * MV3 service worker. Owns settings, batches captured events, and ships them
 * to the local Meme Jarvis backend ingest endpoint. Never sees or stores the
 * Fomo password — it only ever receives whatever normalized JSON the content
 * script scripts forward to it.
 */

const DEFAULTS = {
  backendUrl: "http://localhost:4000/api/fomo/ingest",
  apiKey: "",
  endpointFilter: "",
  domSelector: "",
  enabledOrigin: "",
  captureOn: false,
};

let queue = [];
let stats = { sent: 0, queued: 0, lastError: "", lastSentAt: null };

async function getSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...stored };
}

async function flush() {
  if (queue.length === 0) return;
  const settings = await getSettings();
  const batch = queue.splice(0, queue.length);
  try {
    const res = await fetch(settings.backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(settings.apiKey ? { "X-API-Key": settings.apiKey } : {}),
      },
      body: JSON.stringify({ events: batch }),
    });
    if (!res.ok) throw new Error(`Backend responded ${res.status}`);
    stats.sent += batch.length;
    stats.lastSentAt = new Date().toISOString();
    stats.lastError = "";
  } catch (err) {
    // Put the batch back so we retry on the next alarm tick, but cap growth.
    queue = [...batch, ...queue].slice(0, 500);
    stats.lastError = String(err?.message || err);
  }
  stats.queued = queue.length;
}

chrome.alarms.create("meme-jarvis-flush", { periodInMinutes: 1 / 30 }); // ~every 2s
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "meme-jarvis-flush") flush();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === "fomo-event") {
      const settings = await getSettings();
      if (settings.captureOn) {
        queue.push({ capturedAt: new Date().toISOString(), ...message.event });
        stats.queued = queue.length;
      }
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "get-status") {
      const settings = await getSettings();
      sendResponse({ settings, stats });
      return;
    }

    if (message?.type === "update-settings") {
      await chrome.storage.local.set(message.settings);
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "enable-capture") {
      const origin = message.origin; // e.g. "https://app.fomo.family/*"
      try {
        const granted = await chrome.permissions.request({ origins: [origin] });
        if (!granted) {
          sendResponse({ ok: false, error: "Permission denied" });
          return;
        }
        await chrome.scripting.registerContentScripts([
          {
            id: "meme-jarvis-interceptor",
            matches: [origin],
            js: ["interceptor.js"],
            world: "MAIN",
            runAt: "document_start",
            persistAcrossSessions: true,
          },
          {
            id: "meme-jarvis-relay",
            matches: [origin],
            js: ["relay-content-script.js"],
            world: "ISOLATED",
            runAt: "document_start",
            persistAcrossSessions: true,
          },
        ]).catch(async (err) => {
          // Registering twice throws; unregister stale ones and retry once.
          if (String(err).includes("Duplicate")) {
            await chrome.scripting.unregisterContentScripts({
              ids: ["meme-jarvis-interceptor", "meme-jarvis-relay"],
            });
            await chrome.scripting.registerContentScripts([
              {
                id: "meme-jarvis-interceptor",
                matches: [origin],
                js: ["interceptor.js"],
                world: "MAIN",
                runAt: "document_start",
                persistAcrossSessions: true,
              },
              {
                id: "meme-jarvis-relay",
                matches: [origin],
                js: ["relay-content-script.js"],
                world: "ISOLATED",
                runAt: "document_start",
                persistAcrossSessions: true,
              },
            ]);
          } else {
            throw err;
          }
        });
        await chrome.storage.local.set({ enabledOrigin: origin, captureOn: true });
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: String(err?.message || err) });
      }
      return;
    }

    if (message?.type === "disable-capture") {
      try {
        await chrome.scripting.unregisterContentScripts({
          ids: ["meme-jarvis-interceptor", "meme-jarvis-relay"],
        });
      } catch {
        // Not registered — fine.
      }
      const settings = await getSettings();
      if (settings.enabledOrigin) {
        await chrome.permissions.remove({ origins: [settings.enabledOrigin] }).catch(() => {});
      }
      await chrome.storage.local.set({ captureOn: false, enabledOrigin: "" });
      sendResponse({ ok: true });
      return;
    }
  })();
  return true; // keep the message channel open for the async response
});
