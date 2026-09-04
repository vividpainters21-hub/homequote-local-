# Meme Jarvis — Fomo Capture extension

## What this is (and isn't)

Fomo (the Solana social trading app) does not publish an official public API
or WebSocket feed as of this writing. There is no documented, sanctioned way
to programmatically read your feed. Given that constraint, this extension
uses the **safest technically practical** option:

- It runs entirely inside **your own browser**, on **your own logged-in
  session**, and only on a tab **you explicitly enable**.
- It does not touch, request, store, or transmit your Fomo password or any
  auth token/cookie.
- It does not send any new requests to Fomo. It only **reads the responses
  your browser already received** because you are logged in — the same data
  already rendered on your screen.
- It never runs on any site until you click "Enable capture on this tab" in
  the popup, and it only requests permission for that one origin.

This is labeled throughout the codebase as an **undocumented integration**:
it relies on guessing JSON field names (see `../src/fieldMap.ts`) because
Fomo's frontend has no schema contract. If Fomo ships a redesign, capture may
silently stop working. The rest of Meme Jarvis is unaffected when that
happens — on-chain data (Helius, DEX Screener), risk scoring, clustering, and
paper trading all keep running on their own.

## How it works

1. `popup.js` asks Chrome for permission to inject scripts into your current
   tab's origin only, then registers:
   - `interceptor.js` in the page's own JS context (`world: "MAIN"`), which
     wraps `fetch`/`XMLHttpRequest` to read JSON responses.
   - `relay-content-script.js` in the isolated content-script world, which
     forwards captured payloads to the extension's background service worker.
2. `background.js` batches captured payloads and POSTs them (with your
   configured API key) to your local Meme Jarvis backend's
   `/api/fomo/ingest` endpoint.
3. The backend stores the raw payload (`FomoEvent` table) and runs it through
   `fomo-connector`'s heuristic field-mapper to extract trader/token/trade
   data. Nothing here executes on-chain actions.

## Setup

1. Start the Meme Jarvis backend (`pnpm dev:api` from `/meme-jarvis`) and set
   `FOMO_INGEST_API_KEY` in `meme-jarvis/.env`.
2. Open `chrome://extensions`, enable Developer mode, click "Load unpacked",
   and select this `extension/` folder.
3. Open the extension popup, set the same API key under "Backend API key",
   and confirm the backend URL (default `http://localhost:4000/api/fomo/ingest`).
4. Log into Fomo in a tab as you normally would.
5. Open the popup on that tab and click **Enable capture on this tab**, then
   reload the tab.
6. Use Fomo normally. Captured events flow into the dashboard's "Live Fomo
   Feed" page and the database.

## Tuning capture accuracy

Open Chrome DevTools → Network tab on your logged-in Fomo tab and watch for
XHR/fetch requests while the feed updates (filter by "Fetch/XHR"). If you
find the specific endpoint that returns feed/trade data:

- Enter a substring of its path into the popup's **Endpoint filter** field
  so only that response is captured (reduces noise and false matches).
- If the JSON field names Fomo uses aren't already covered, add them to the
  candidate lists in `../src/fieldMap.ts` (e.g. add `"myFieldName"` to
  `FIELD_CANDIDATES.walletAddress`). No other code needs to change.

If the feed is rendered from a WebSocket message rather than fetch/XHR, this
extension's network interceptor won't see it (patching WebSocket is
higher-risk and more likely to interfere with the app, so it's intentionally
not included by default). In that case, use the DOM fallback: send
`{type: "set-dom-selector", selector: "<css selector for a feed row>"}` to
the content script, or extend `interceptor.js`'s DOM observer.

## Safety notes

- Do not modify this extension to submit login forms, read `localStorage`
  auth tokens, or exfiltrate cookies. That would cross from "reading data
  already shown to you" into credential theft, which this project explicitly
  refuses to do.
- Only click "Enable" on tabs you control and are logged into yourself.
- Uninstalling the extension or clicking "Disable capture" immediately stops
  all data collection and revokes the granted host permission.
