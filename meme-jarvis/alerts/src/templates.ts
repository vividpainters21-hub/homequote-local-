import type { AlertCategory } from "@meme-jarvis/shared";

function esc(value: unknown): string {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface SmartMoneyClusterAlertData {
  symbol: string;
  opportunityScore: number;
  riskScore: number;
  memberCount: number;
  windowSeconds: number;
  avgTraderScore: number;
  liquidityUsd: number;
  volume5mChangePct?: number;
  buySellRatio?: number;
  priceChangeSincePct: number | null;
  status: string;
}

export function formatSmartMoneyCluster(d: SmartMoneyClusterAlertData): string {
  return [
    `🔥 <b>MEME JARVIS — SMART MONEY CLUSTER</b>`,
    `Token: <b>${esc(d.symbol)}</b>`,
    `Opportunity: ${d.opportunityScore.toFixed(0)}/100`,
    `Risk: ${d.riskScore.toFixed(0)}/100`,
    `${d.memberCount} elite traders entered within ${d.windowSeconds}s.`,
    `Average trader score: ${d.avgTraderScore.toFixed(0)}`,
    `Liquidity: $${Math.round(d.liquidityUsd).toLocaleString()}`,
    d.volume5mChangePct !== undefined ? `5m volume: ${d.volume5mChangePct >= 0 ? "+" : ""}${d.volume5mChangePct.toFixed(0)}%` : undefined,
    d.buySellRatio !== undefined ? `Buy/sell ratio: ${d.buySellRatio.toFixed(1)}:1` : undefined,
    d.priceChangeSincePct !== null ? `Price since first tracked entry: ${d.priceChangeSincePct >= 0 ? "+" : ""}${d.priceChangeSincePct.toFixed(0)}%` : undefined,
    `Status:\n<b>${esc(d.status)}</b>`,
  ]
    .filter(Boolean)
    .join("\n");
}

export interface HighScoreAlertData {
  symbol: string;
  opportunityScore: number;
  riskScore: number;
  reasons: string[];
}

export function formatHighScore(d: HighScoreAlertData): string {
  return [
    `⭐ <b>HIGH SCORE</b>`,
    `Token: <b>${esc(d.symbol)}</b>`,
    `Opportunity: ${d.opportunityScore.toFixed(0)}/100 | Risk: ${d.riskScore.toFixed(0)}/100`,
    d.reasons.length ? `Reasons:\n${d.reasons.map((r, i) => `${i + 1}. ${esc(r)}`).join("\n")}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatRapidScoreIncrease(d: { symbol: string; previousScore: number; currentScore: number }): string {
  return [
    `📈 <b>RAPID SCORE INCREASE</b>`,
    `Token: <b>${esc(d.symbol)}</b>`,
    `Score moved ${d.previousScore.toFixed(0)} → ${d.currentScore.toFixed(0)} in the last check.`,
  ].join("\n");
}

export function formatSmartMoneyExit(d: { symbol: string; exitingCount: number; holdingCount: number }): string {
  return [
    `🚪 <b>SMART MONEY EXIT</b>`,
    `Token: <b>${esc(d.symbol)}</b>`,
    `${d.exitingCount} tracked smart wallet(s) exiting vs ${d.holdingCount} still holding.`,
  ].join("\n");
}

export function formatWhaleDump(d: { symbol: string; walletAddress: string; valueUsd: number }): string {
  return [
    `🐋 <b>WHALE DUMP</b>`,
    `Token: <b>${esc(d.symbol)}</b>`,
    `Wallet ${esc(d.walletAddress.slice(0, 6))}… sold $${Math.round(d.valueUsd).toLocaleString()}.`,
  ].join("\n");
}

export function formatLiquidityWarning(d: { symbol: string; liquidityUsd: number; changePct: number }): string {
  return [
    `⚠️ <b>LIQUIDITY WARNING</b>`,
    `Token: <b>${esc(d.symbol)}</b>`,
    `Liquidity $${Math.round(d.liquidityUsd).toLocaleString()} (${d.changePct >= 0 ? "+" : ""}${d.changePct.toFixed(0)}%).`,
  ].join("\n");
}

export function formatRugWarning(d: { symbol: string; flags: string[] }): string {
  return [
    `🚨 <b>RUG WARNING</b>`,
    `Token: <b>${esc(d.symbol)}</b>`,
    d.flags.length ? d.flags.map((f) => `• ${esc(f)}`).join("\n") : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatPaperEntry(d: { symbol: string; sizeUsd: number; entryPriceUsd: number; reason: string }): string {
  return [
    `🟢 <b>PAPER ENTRY</b>`,
    `Token: <b>${esc(d.symbol)}</b>`,
    `Size: $${d.sizeUsd.toLocaleString()} @ $${d.entryPriceUsd.toFixed(8)}`,
    `Reason: ${esc(d.reason)}`,
  ].join("\n");
}

export function formatPaperExit(d: { symbol: string; pnlUsd: number; returnPct: number; reason: string }): string {
  const emoji = d.pnlUsd >= 0 ? "✅" : "❌";
  return [
    `${emoji} <b>PAPER EXIT</b>`,
    `Token: <b>${esc(d.symbol)}</b>`,
    `PnL: ${d.pnlUsd >= 0 ? "+" : ""}$${d.pnlUsd.toFixed(2)} (${d.returnPct >= 0 ? "+" : ""}${d.returnPct.toFixed(1)}%)`,
    `Exit reason: ${esc(d.reason)}`,
  ].join("\n");
}

export const CATEGORY_LABELS: Record<AlertCategory, string> = {
  SMART_MONEY_CLUSTER: "Smart Money Cluster",
  HIGH_SCORE: "High Score",
  RAPID_SCORE_INCREASE: "Rapid Score Increase",
  SMART_MONEY_EXIT: "Smart Money Exit",
  WHALE_DUMP: "Whale Dump",
  LIQUIDITY_WARNING: "Liquidity Warning",
  RUG_WARNING: "Rug Warning",
  PAPER_ENTRY: "Paper Entry",
  PAPER_EXIT: "Paper Exit",
};
