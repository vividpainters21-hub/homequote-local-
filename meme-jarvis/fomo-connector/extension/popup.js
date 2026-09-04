const currentOriginEl = document.getElementById("currentOrigin");
const statusEl = document.getElementById("status");
const backendUrlEl = document.getElementById("backendUrl");
const apiKeyEl = document.getElementById("apiKey");
const endpointFilterEl = document.getElementById("endpointFilter");

let activeTabOrigin = "";

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function refreshStatus() {
  const { settings, stats } = await chrome.runtime.sendMessage({ type: "get-status" });
  backendUrlEl.value = settings.backendUrl;
  apiKeyEl.value = settings.apiKey;
  endpointFilterEl.value = settings.endpointFilter;
  statusEl.innerHTML = `
    Capture: <b>${settings.captureOn ? "ON (" + settings.enabledOrigin + ")" : "off"}</b><br/>
    Sent: ${stats.sent} &nbsp; Queued: ${stats.queued}<br/>
    Last sent: ${stats.lastSentAt ?? "never"}<br/>
    ${stats.lastError ? `<span style="color:#ef4444">Error: ${stats.lastError}</span>` : ""}
  `;
}

async function init() {
  const tab = await getActiveTab();
  if (tab?.url) {
    const url = new URL(tab.url);
    activeTabOrigin = `${url.origin}/*`;
    currentOriginEl.value = url.origin;
  }
  await refreshStatus();
}

document.getElementById("enableBtn").addEventListener("click", async () => {
  if (!activeTabOrigin) return;
  const res = await chrome.runtime.sendMessage({ type: "enable-capture", origin: activeTabOrigin });
  if (!res.ok) statusEl.innerHTML = `<span style="color:#ef4444">${res.error}</span>`;
  await refreshStatus();
  statusEl.innerHTML += `<br/>Reload the tab for capture to start.`;
});

document.getElementById("disableBtn").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "disable-capture" });
  await refreshStatus();
});

document.getElementById("saveBtn").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({
    type: "update-settings",
    settings: {
      backendUrl: backendUrlEl.value.trim(),
      apiKey: apiKeyEl.value.trim(),
      endpointFilter: endpointFilterEl.value.trim(),
    },
  });
  await refreshStatus();
});

init();
