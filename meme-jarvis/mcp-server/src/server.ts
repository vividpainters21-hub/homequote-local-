import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as q from "./queries.js";

const server = new McpServer({ name: "meme-jarvis", version: "0.1.0" });

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

server.tool(
  "get_fomo_live_feed",
  "Returns the most recent trades captured from the Fomo live feed (via the browser extension), newest first. Use this to answer 'what's happening on Fomo right now'.",
  { limit: z.number().int().min(1).max(200).default(50) },
  async ({ limit }) => json(await q.getFomoLiveFeed(limit))
);

server.tool(
  "get_top_traders",
  "Returns our own trader-ranking (0-100 trader score), not any label from Fomo or another platform. By default only includes wallets with enough observed trades to be statistically meaningful.",
  { limit: z.number().int().min(1).max(100).default(25), requireSampleSizeOk: z.boolean().default(true) },
  async ({ limit, requireSampleSizeOk }) => json(await q.getTopTraders(limit, requireSampleSizeOk))
);

server.tool(
  "get_trader_profile",
  "Full stats for one wallet: win rate, PnL, profit factor, drawdown, consistency, recent vs lifetime performance, and trader score.",
  { walletAddress: z.string() },
  async ({ walletAddress }) => json(await q.getTraderProfile(walletAddress))
);

server.tool(
  "get_trader_recent_trades",
  "Recent buy/sell trades for one wallet.",
  { walletAddress: z.string(), limit: z.number().int().min(1).max(200).default(50) },
  async ({ walletAddress, limit }) => json(await q.getTraderRecentTrades(walletAddress, limit))
);

server.tool(
  "get_token_analysis",
  "Full analysis for one token (by mint address or symbol): market snapshots, opportunity score history, risk assessments, holder concentration, clusters, and recent trades.",
  { mintOrSymbol: z.string() },
  async ({ mintOrSymbol }) => json(await q.getTokenAnalysis(mintOrSymbol))
);

server.tool(
  "get_token_risk",
  "Latest risk assessment (0-100, 100=most dangerous) for one token, including every triggered risk flag and whether it's automatically disqualified.",
  { mintOrSymbol: z.string() },
  async ({ mintOrSymbol }) => json(await q.getTokenRisk(mintOrSymbol))
);

server.tool(
  "get_token_smart_money",
  "Which tracked smart-money wallets have bought or sold this token recently, and whether they're still holding.",
  { mintOrSymbol: z.string(), sinceMinutes: z.number().int().min(1).max(1440).default(360) },
  async ({ mintOrSymbol, sinceMinutes }) => json(await q.getTokenSmartMoney(mintOrSymbol, sinceMinutes))
);

server.tool(
  "find_smart_money_clusters",
  "Finds tokens where multiple strong (high trader-score) wallets bought within a short time window recently. This is the core 'coordinated smart money' signal.",
  {
    minScore: z.number().min(0).max(100).default(50),
    sinceMinutes: z.number().int().min(1).max(1440).default(360),
    limit: z.number().int().min(1).max(100).default(20),
  },
  async ({ minScore, sinceMinutes, limit }) => json(await q.findSmartMoneyClusters(minScore, sinceMinutes, limit))
);

server.tool(
  "find_early_momentum",
  "Finds young tokens (by default under 2 hours old) with a decent opportunity score and no critical risk flags — useful for 'find something early' style queries.",
  {
    maxAgeMinutes: z.number().int().min(1).max(1440).default(120),
    minScore: z.number().min(0).max(100).default(60),
    limit: z.number().int().min(1).max(100).default(20),
  },
  async ({ maxAgeMinutes, minScore, limit }) => json(await q.findEarlyMomentum(maxAgeMinutes, minScore, 100, limit))
);

server.tool(
  "find_top_opportunities",
  "The current best-scoring, acceptable-risk tokens, sorted by opportunity score. Use for 'what are the best setups right now'.",
  {
    minScore: z.number().min(0).max(100).default(70),
    maxRisk: z.number().min(0).max(100).default(50),
    limit: z.number().int().min(1).max(100).default(20),
  },
  async ({ minScore, maxRisk, limit }) => json(await q.findTopOpportunities(minScore, maxRisk, limit))
);

server.tool(
  "find_recent_dumps",
  "Tokens that recently triggered high risk scores or critical disqualification (liquidity collapse, whale dump, rug flags, etc).",
  { sinceMinutes: z.number().int().min(1).max(1440).default(60), limit: z.number().int().min(1).max(100).default(20) },
  async ({ sinceMinutes, limit }) => json(await q.findRecentDumps(sinceMinutes, limit))
);

server.tool(
  "find_traders_exiting",
  "Strong (high trader-score) wallets that sold a position recently, across all tokens.",
  { sinceMinutes: z.number().int().min(1).max(1440).default(15), limit: z.number().int().min(1).max(200).default(50) },
  async ({ sinceMinutes, limit }) => json(await q.findTradersExiting(sinceMinutes, limit))
);

server.tool(
  "get_market_overview",
  "High-level snapshot: total tracked tokens/traders, alerts in the last hour, open paper positions, top opportunities, and the most recent smart-money clusters.",
  {},
  async () => json(await q.getMarketOverview())
);

server.tool(
  "get_paper_portfolio",
  "Current paper-trading account balance and open simulated positions. This system trades with SIMULATED money only — there is no live-trading execution path.",
  { account: z.string().default("default") },
  async ({ account }) => json(await q.getPaperPortfolio(account))
);

server.tool(
  "get_paper_trade_history",
  "Closed paper trades with full entry/exit reasoning, PnL, and the signal data that triggered them.",
  { account: z.string().default("default"), limit: z.number().int().min(1).max(500).default(50) },
  async ({ account, limit }) => json(await q.getPaperTradeHistory(account, limit))
);

server.tool(
  "explain_signal",
  "Returns the exact structured facts (score breakdown, reasons, warnings, risk flags, recent clusters) behind one token's current score, so you can explain WHY it scored the way it did. Treat everything under `facts` as ground truth from our engines; label anything else you add as inference, not fact.",
  { mintOrSymbol: z.string() },
  async ({ mintOrSymbol }) => json(await q.explainSignal(mintOrSymbol))
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Meme Jarvis MCP server running on stdio.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
