# Meme Jarvis

A live meme-coin intelligence platform for Solana: it watches your logged-in
Fomo feed, combines it with on-chain and DEX market data, builds its **own**
trader-ranking system (never trusting another platform's "smart money"
label), detects coordinated smart-wallet buying, scores tokens on
opportunity (0-100) and risk (0-100), explains its reasoning, and
paper-trades the resulting signals so you can measure whether the strategy
is actually profitable before ever risking real money.

**This system does not target or promise a 100% win rate. It does not place
real trades. There is no code path anywhere in this repository that can send
a real transaction, and it never sees your Fomo password or a wallet seed
phrase.**

## Architecture

```
meme-jarvis/
  fomo-connector/     Fomo integration: normalizer + Chrome extension (undocumented, best-effort)
  market-data/        DEX Screener (official public API) + optional Birdeye
  solana/             Helius RPC/enhanced-tx/webhooks + on-chain mint/holder checks + Jupiter quote
  wallet-intelligence/ Our own 0-100 trader-scoring engine
  cluster-engine/      Smart-money entry-cluster detection
  risk-engine/         0-100 token risk score + critical disqualifiers
  scoring-engine/      0-100 opportunity score, configurable weights
  paper-trading/       Simulated entries/exits + performance analytics
  alerts/              Telegram Bot API integration
  api/                 Fastify backend: REST + WebSocket + the orchestration pipeline
  mcp-server/          MCP server so Claude Desktop/Code can query live data
  dashboard/           Next.js dark-mode dashboard
  database/            Prisma schema (Postgres / Supabase)
  tests/               Vitest unit tests for the scoring/risk/cluster/paper engines
```

Every module is independently replaceable. In particular, `fomo-connector`
is the only piece that depends on Fomo's undocumented frontend behavior — if
it breaks after a Fomo update, on-chain tracking, risk scoring, clustering,
and paper trading keep working unaffected.

## Prerequisites

- **Node.js 20+** — https://nodejs.org (LTS)
- **pnpm** — after installing Node, run `corepack enable` then `corepack prepare pnpm@latest --activate`
- **PostgreSQL** — either a local install, Docker, or a free **Supabase**
  project (https://supabase.com). Supabase is the easiest path on Windows.
- **Google Chrome** (for the Fomo-capture extension)
- Free API keys (all optional except Postgres, but the platform is far more
  useful with them):
  - **Helius** — https://dev.helius.xyz (Solana RPC + on-chain data)
  - **Telegram bot token** — message [@BotFather](https://t.me/BotFather) in Telegram
  - **Birdeye** — https://docs.birdeye.so (optional, fills a few data gaps)

## Windows setup, step by step

1. **Install Node.js**: download the LTS installer from nodejs.org and run
   it, accepting the defaults.
2. **Open PowerShell** (Start menu → type `PowerShell` → Enter).
3. **Enable pnpm**:
   ```powershell
   corepack enable
   corepack prepare pnpm@latest --activate
   ```
4. **Get a Postgres database.** Easiest option — Supabase:
   1. Create a free project at https://supabase.com.
   2. Go to Project Settings → Database → Connection string → URI. Copy it.
5. **Clone or download this repository**, then in PowerShell:
   ```powershell
   cd path\to\homequote-local-\meme-jarvis
   pnpm install
   ```
6. **Configure environment variables**:
   ```powershell
   copy .env.example .env
   notepad .env
   ```
   Paste your Supabase connection string into `DATABASE_URL`, and fill in
   `HELIUS_API_KEY` / `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` if you have
   them (you can leave them blank and add them later — the app degrades
   gracefully). Set `FOMO_INGEST_API_KEY` to any random string.
7. **Create the database tables**:
   ```powershell
   pnpm db:generate
   pnpm --filter=./database exec prisma migrate deploy
   ```
   (If this is the very first migration and `migrate deploy` says there's
   nothing to deploy, run `pnpm --filter=./database exec prisma migrate dev --name init` instead.)
8. **Build the backend packages**:
   ```powershell
   pnpm build
   ```
9. **Start the API + pipeline** (in its own PowerShell window):
   ```powershell
   pnpm dev:api
   ```
   You should see `Meme Jarvis API listening on :4000`.
10. **Start the dashboard** (in another PowerShell window):
    ```powershell
    cd path\to\homequote-local-\meme-jarvis\dashboard
    pnpm install
    pnpm dev
    ```
    Open http://localhost:3100 in your browser.
11. **Install the Fomo-capture Chrome extension**:
    1. Open `chrome://extensions` in Chrome.
    2. Toggle **Developer mode** on (top right).
    3. Click **Load unpacked** and select `meme-jarvis\fomo-connector\extension`.
    4. Click the extension icon, paste the same `FOMO_INGEST_API_KEY` you put
       in `.env`, and confirm the backend URL (`http://localhost:4000/api/fomo/ingest`).
    5. Log into Fomo in a tab as normal, open the popup on that tab, click
       **Enable capture on this tab**, then reload the tab.
    6. Full details and safety notes: `fomo-connector/extension/README.md`.
12. **(Optional) Connect the MCP server to Claude Desktop** so you can ask
    Claude things like "what are the best setups right now?":
    1. Build it: `pnpm --filter=./mcp-server run build`.
    2. Open Claude Desktop's config file (`%APPDATA%\Claude\claude_desktop_config.json`
       on Windows) and add:
       ```json
       {
         "mcpServers": {
           "meme-jarvis": {
             "command": "node",
             "args": ["C:\\path\\to\\homequote-local-\\meme-jarvis\\mcp-server\\dist\\server.js"],
             "env": { "DATABASE_URL": "your-connection-string" }
           }
         }
       }
       ```
    3. Restart Claude Desktop.

You now have: the API + background pipeline running, the dashboard open,
the Fomo extension capturing your feed, and (optionally) Claude able to
query everything live via MCP.

## Running tests

```powershell
pnpm db:generate
pnpm build
pnpm --filter=./tests run test
```

The test suite covers the scoring engines' actual behavior — not just that
they run, but that a single lucky trade can't make a trader look elite, that
a critical risk flag always disqualifies a token regardless of its
opportunity score, that clusters require real coordination in a real time
window, and that every paper-trading exit rule fires when it should.

## Data sources and their status

| Source | Status | Notes |
|---|---|---|
| DEX Screener | Official public API, no key needed | Primary price/liquidity/volume source |
| Helius | Official API, requires free key | On-chain mint/freeze authority, holder concentration, enhanced tx history, webhooks |
| Birdeye | Official API, optional | Fills 1m/15m volume + unique-buyer gaps DEX Screener doesn't expose |
| Jupiter Quote API | Official public API, no key needed | Read-only "can this token be sold" check — never submits a swap |
| Fomo | **No official API** | Browser-extension capture of your own authenticated session; clearly labeled undocumented/best-effort in `fomo-connector/` |
| Telegram Bot API | Official API, requires free bot token | Alert delivery only |

## Safety

- Live (real-money) trading is **not implemented**. There is no wallet
  integration, no private-key handling, and no execution path.
- The Fomo browser extension never reads, stores, or transmits your Fomo
  password, and only runs on a tab you explicitly enable.
- Secrets live in `.env` (git-ignored) and environment variables only — none
  are logged.
- If real execution is ever added on top of this, the project's own design
  intent (see the top-level task this was built from) requires: a dedicated,
  balance-limited trading wallet separate from any main wallet; hard-coded
  max trade size, max daily loss, max consecutive losses, max slippage, and
  minimum liquidity; an emergency kill switch and automatic shutdown on
  abnormal losses or data-source failure; no withdrawal capability; and none
  of those hard limits overridable by Claude or any AI-generated decision.

## Configuring the opportunity-score weights

Weights are stored in the `ScoringConfig` table, not hard-coded, so you can
backtest alternatives:

```
GET  /api/scoring/weights                  # list saved weight sets
POST /api/scoring/weights                  # { name, weights: {...} } — save a new set
POST /api/scoring/weights/:name/activate   # switch the live pipeline to that set
```

Use the `/api/paper/analytics` breakdowns (also shown on the Performance
dashboard page) to see whether a weight change actually improved results —
e.g. "do 90+ signals outperform 80-89?" or "do 5-wallet clusters beat
3-wallet clusters?" — before committing to it.
