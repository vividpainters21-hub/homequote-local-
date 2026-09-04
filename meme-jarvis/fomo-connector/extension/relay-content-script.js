/**
 * Runs in the ISOLATED content-script world (has chrome.runtime access, but
 * cannot see the page's own JS variables — that's what interceptor.js in the
 * MAIN world is for). Bridges window.postMessage -> chrome.runtime.sendMessage.
 */
const CHANNEL = "meme-jarvis-fomo";

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.channel !== CHANNEL) return;
  chrome.runtime.sendMessage({ type: "fomo-event", event: data.payload }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "set-dom-selector") {
    window.postMessage({ channel: "meme-jarvis-set-dom-selector", selector: message.selector }, "*");
  }
});
