/**
 * Runs in the PAGE's own JS context (world: "MAIN"), injected only into tabs
 * the user explicitly enabled via the extension popup.
 *
 * What it does:
 *  - Wraps window.fetch and XMLHttpRequest so we can read the JSON *responses*
 *    the page already received from its own logged-in session. This does not
 *    add, change, or forward any request, header, cookie, or credential — it
 *    only observes data the authenticated tab already has.
 *  - Optionally watches the DOM (MutationObserver) for feed items, using CSS
 *    selectors YOU configure in the popup, as a fallback when a feed doesn't
 *    come from a fetch/XHR call (e.g. it's rendered from a WebSocket message).
 *
 * This file deliberately contains NO Fomo-specific selectors or endpoint
 * paths — Fomo publishes no API docs, and hard-coding guesses here would
 * silently break on every frontend deploy. Instead every captured
 * fetch/XHR JSON response is forwarded up to the backend, where
 * fomo-connector's heuristic field-mapper (see fieldMap.ts) extracts trade
 * data. If you know the exact feed endpoint path, you can narrow capture by
 * setting an "endpoint filter" substring in the popup.
 */
(() => {
  const CHANNEL = "meme-jarvis-fomo";

  function post(payload) {
    window.postMessage({ channel: CHANNEL, payload }, "*");
  }

  function safeParseJson(text) {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  function getEndpointFilter() {
    return window.__memeJarvisEndpointFilter || "";
  }

  // --- fetch() ---
  const originalFetch = window.fetch;
  window.fetch = async function patchedFetch(...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : (args[0] && args[0].url) || "";
      const filter = getEndpointFilter();
      if (!filter || url.includes(filter)) {
        const clone = response.clone();
        clone
          .text()
          .then((text) => {
            const json = safeParseJson(text);
            if (json) post({ method: "extension-network", sourceUrl: url, raw: json });
          })
          .catch(() => {});
      }
    } catch {
      // Never let capture errors break the page's own network calls.
    }
    return response;
  };

  // --- XMLHttpRequest ---
  const OriginalXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    const xhr = new OriginalXHR();
    let capturedUrl = "";
    const originalOpen = xhr.open;
    xhr.open = function (method, url, ...rest) {
      capturedUrl = url;
      return originalOpen.call(xhr, method, url, ...rest);
    };
    xhr.addEventListener("load", () => {
      try {
        const filter = getEndpointFilter();
        if (!filter || String(capturedUrl).includes(filter)) {
          const json = safeParseJson(xhr.responseText);
          if (json) post({ method: "extension-network", sourceUrl: capturedUrl, raw: json });
        }
      } catch {
        // ignore
      }
    });
    return xhr;
  }
  window.XMLHttpRequest = PatchedXHR;

  // --- Optional DOM fallback ---
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.channel !== "meme-jarvis-set-dom-selector") return;
    const selector = event.data.selector;
    if (!selector) return;
    const observer = new MutationObserver(() => {
      const nodes = document.querySelectorAll(selector);
      nodes.forEach((node) => {
        if (node.getAttribute("data-meme-jarvis-seen")) return;
        node.setAttribute("data-meme-jarvis-seen", "1");
        post({ method: "extension-dom", sourceUrl: location.href, raw: { text: node.textContent, html: node.innerHTML } });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });

  post({ method: "extension-network", sourceUrl: location.href, raw: { __memeJarvisReady: true } });
})();
