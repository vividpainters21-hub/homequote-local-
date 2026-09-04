import { prisma } from "@meme-jarvis/database";
import { getTopTraders as getTopTradersQuery } from "@meme-jarvis/wallet-intelligence";
import { getOrCreateAccount } from "@meme-jarvis/paper-trading";

const STRONG_TRADER_SCORE = Number(process.env.STRONG_TRADER_SCORE ?? 60);

export async function getFomoLiveFeed(limit = 50) {
  return prisma.trade.findMany({
    where: { source: "FOMO" },
    orderBy: { occurredAt: "desc" },
    take: limit,
    include: { wallet: true, token: true },
  });
}

export async function getTopTraders(limit = 25, requireSampleSizeOk = true) {
  return getTopTradersQuery({ limit, requireSampleSizeOk });
}

export async function getTraderProfile(walletAddress: string) {
  return prisma.wallet.findUnique({
    where: { address: walletAddress },
    include: { scoreHistory: { orderBy: { recordedAt: "desc" }, take: 60 } },
  });
}

export async function getTraderRecentTrades(walletAddress: string, limit = 50) {
  const wallet = await prisma.wallet.findUnique({ where: { address: walletAddress } });
  if (!wallet) return null;
  return prisma.trade.findMany({
    where: { walletId: wallet.id },
    orderBy: { occurredAt: "desc" },
    take: limit,
    include: { token: true },
  });
}

async function resolveToken(mintOrSymbol: string) {
  return prisma.token.findFirst({
    where: { OR: [{ mintAddress: mintOrSymbol }, { symbol: { equals: mintOrSymbol, mode: "insensitive" } }] },
  });
}

export async function getTokenAnalysis(mintOrSymbol: string) {
  const token = await resolveToken(mintOrSymbol);
  if (!token) return null;
  return prisma.token.findUnique({
    where: { id: token.id },
    include: {
      snapshots: { orderBy: { recordedAt: "desc" }, take: 20 },
      opportunityScores: { orderBy: { computedAt: "desc" }, take: 5 },
      riskAssessments: { orderBy: { computedAt: "desc" }, take: 3 },
      holders: { orderBy: { recordedAt: "desc" }, take: 1 },
      clusters: { orderBy: { createdAt: "desc" }, take: 5, include: { members: { include: { wallet: true } } } },
      trades: { orderBy: { occurredAt: "desc" }, take: 30, include: { wallet: true } },
    },
  });
}

export async function getTokenRisk(mintOrSymbol: string) {
  const token = await resolveToken(mintOrSymbol);
  if (!token) return null;
  return prisma.riskAssessment.findFirst({ where: { tokenId: token.id }, orderBy: { computedAt: "desc" } });
}

export async function getTokenSmartMoney(mintOrSymbol: string, sinceMinutes = 360) {
  const token = await resolveToken(mintOrSymbol);
  if (!token) return null;
  const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
  const trades = await prisma.trade.findMany({
    where: {
      tokenId: token.id,
      occurredAt: { gte: since },
      wallet: { sampleSizeOk: true, traderScore: { gte: STRONG_TRADER_SCORE } },
    },
    include: { wallet: true },
    orderBy: { occurredAt: "asc" },
  });
  const byWallet = new Map<string, { wallet: (typeof trades)[number]["wallet"]; lastSide: "BUY" | "SELL"; lastAt: Date }>();
  for (const t of trades) {
    byWallet.set(t.wallet.address, { wallet: t.wallet, lastSide: t.side, lastAt: t.occurredAt });
  }
  const holding = [...byWallet.values()].filter((w) => w.lastSide === "BUY");
  const exited = [...byWallet.values()].filter((w) => w.lastSide === "SELL");
  return { tokenMint: token.mintAddress, symbol: token.symbol, holding, exited, totalTracked: byWallet.size };
}

export async function findSmartMoneyClusters(minScore = 50, sinceMinutes = 360, limit = 20) {
  const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
  return prisma.cluster.findMany({
    where: { clusterScore: { gte: minScore }, createdAt: { gte: since } },
    orderBy: { clusterScore: "desc" },
    take: limit,
    include: { token: true, members: { include: { wallet: true } } },
  });
}

export async function findEarlyMomentum(maxAgeMinutes = 120, minScore = 60, maxAlreadyPumpedPct = 100, limit = 20) {
  const tokens = await prisma.token.findMany({
    where: { tokenCreatedAt: { gte: new Date(Date.now() - maxAgeMinutes * 60 * 1000) } },
    include: {
      snapshots: { orderBy: { recordedAt: "desc" }, take: 1 },
      opportunityScores: { orderBy: { computedAt: "desc" }, take: 1 },
      riskAssessments: { orderBy: { computedAt: "desc" }, take: 1 },
    },
  });
  return tokens
    .filter((t) => t.opportunityScores[0] && t.opportunityScores[0].score >= minScore)
    .filter((t) => !t.riskAssessments[0]?.criticalDisqualified)
    .map((t) => ({
      mint: t.mintAddress,
      symbol: t.symbol,
      ageMinutes: t.tokenCreatedAt ? (Date.now() - t.tokenCreatedAt.getTime()) / 60000 : null,
      score: t.opportunityScores[0]?.score,
      riskScore: t.riskAssessments[0]?.riskScore,
      priceUsd: t.snapshots[0]?.priceUsd,
      liquidityUsd: t.snapshots[0]?.liquidityUsd,
    }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
  // Note: maxAlreadyPumpedPct isn't a stored column — "not already pumped" is
  // already folded into `score` via the opportunity engine's extension factor.
}

export async function findTopOpportunities(minScore = 70, maxRisk = 50, limit = 20) {
  const tokens = await prisma.token.findMany({
    include: {
      snapshots: { orderBy: { recordedAt: "desc" }, take: 1 },
      opportunityScores: { orderBy: { computedAt: "desc" }, take: 1 },
      riskAssessments: { orderBy: { computedAt: "desc" }, take: 1 },
    },
  });
  return tokens
    .filter((t) => (t.opportunityScores[0]?.score ?? 0) >= minScore)
    .filter((t) => (t.riskAssessments[0]?.riskScore ?? 100) <= maxRisk)
    .filter((t) => !t.riskAssessments[0]?.criticalDisqualified)
    .map((t) => ({
      mint: t.mintAddress,
      symbol: t.symbol,
      score: t.opportunityScores[0]?.score,
      status: t.opportunityScores[0]?.status,
      riskScore: t.riskAssessments[0]?.riskScore,
      priceUsd: t.snapshots[0]?.priceUsd,
      liquidityUsd: t.snapshots[0]?.liquidityUsd,
      reasons: t.opportunityScores[0]?.reasons,
    }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}

export async function findRecentDumps(sinceMinutes = 60, limit = 20) {
  const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
  const risky = await prisma.riskAssessment.findMany({
    where: { computedAt: { gte: since }, OR: [{ riskScore: { gte: 60 } }, { criticalDisqualified: true }] },
    orderBy: { computedAt: "desc" },
    take: limit,
    include: { token: true },
  });
  return risky.map((r) => ({
    mint: r.token.mintAddress,
    symbol: r.token.symbol,
    riskScore: r.riskScore,
    criticalDisqualified: r.criticalDisqualified,
    flags: r.flags,
    computedAt: r.computedAt,
  }));
}

export async function findTradersExiting(sinceMinutes = 15, limit = 50) {
  const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
  return prisma.trade.findMany({
    where: { side: "SELL", occurredAt: { gte: since }, wallet: { sampleSizeOk: true, traderScore: { gte: STRONG_TRADER_SCORE } } },
    include: { wallet: true, token: true },
    orderBy: { occurredAt: "desc" },
    take: limit,
  });
}

export async function getMarketOverview() {
  const [tokenCount, walletCount, alertsLastHour, openPositions] = await Promise.all([
    prisma.token.count(),
    prisma.wallet.count({ where: { sampleSizeOk: true } }),
    prisma.alert.count({ where: { createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } }),
    prisma.paperPosition.count({ where: { status: "OPEN" } }),
  ]);
  const topOpportunities = await findTopOpportunities(70, 50, 10);
  const recentClusters = await prisma.cluster.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { token: true } });
  return { tokenCount, trackedStrongTraders: walletCount, alertsLastHour, openPaperPositions: openPositions, topOpportunities, recentClusters };
}

export async function getPaperPortfolio(accountName = "default") {
  const account = await getOrCreateAccount(accountName);
  const positions = await prisma.paperPosition.findMany({
    where: { accountId: account.id, status: "OPEN" },
    include: { token: true },
  });
  return { account, positions };
}

export async function getPaperTradeHistory(accountName = "default", limit = 50) {
  const account = await getOrCreateAccount(accountName);
  return prisma.paperTrade.findMany({
    where: { accountId: account.id },
    orderBy: { closedAt: "desc" },
    take: limit,
    include: { token: true },
  });
}

export async function explainSignal(mintOrSymbol: string) {
  const token = await resolveToken(mintOrSymbol);
  if (!token) return null;
  const [opportunity, risk, clusters] = await Promise.all([
    prisma.opportunityScore.findFirst({ where: { tokenId: token.id }, orderBy: { computedAt: "desc" } }),
    prisma.riskAssessment.findFirst({ where: { tokenId: token.id }, orderBy: { computedAt: "desc" } }),
    prisma.cluster.findMany({ where: { tokenId: token.id }, orderBy: { createdAt: "desc" }, take: 3 }),
  ]);
  return {
    token: { mint: token.mintAddress, symbol: token.symbol },
    facts: {
      opportunityScore: opportunity?.score ?? null,
      opportunityBreakdown: opportunity?.breakdown ?? null,
      opportunityReasons: opportunity?.reasons ?? null,
      opportunityWarnings: opportunity?.warnings ?? null,
      riskScore: risk?.riskScore ?? null,
      riskFlags: risk?.flags ?? null,
      criticalDisqualified: risk?.criticalDisqualified ?? null,
      recentClusters: clusters,
    },
    note:
      "Everything under `facts` was computed directly by the scoring/risk/cluster engines from live data. Base your explanation strictly on these facts; label anything you add beyond them (predictions, opinions, comparisons not shown here) explicitly as inference, not fact. This system does not guarantee a 100% win rate.",
  };
}
