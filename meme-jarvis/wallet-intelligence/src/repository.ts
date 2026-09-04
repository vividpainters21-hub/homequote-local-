import { prisma } from "@meme-jarvis/database";
import type { TraderTrade } from "@meme-jarvis/shared";
import { buildRoundTrips } from "./roundTrips.js";
import { computeWalletStats } from "./scoring.js";

/**
 * A token is treated as "rugged" for scoring purposes if its price or
 * liquidity has collapsed >90% from its observed peak. This is intentionally
 * simple and reuses the same snapshots the risk engine reads.
 */
async function buildRugLookup(tokenMints: string[]): Promise<(mint: string) => boolean> {
  const ruggedSet = new Set<string>();
  for (const mint of tokenMints) {
    const token = await prisma.token.findUnique({ where: { mintAddress: mint } });
    if (!token) continue;
    const snapshots = await prisma.tokenSnapshot.findMany({
      where: { tokenId: token.id },
      orderBy: { recordedAt: "asc" },
      select: { priceUsd: true, liquidityUsd: true },
    });
    if (snapshots.length < 2) continue;
    const peakPrice = Math.max(...snapshots.map((s) => s.priceUsd));
    const peakLiquidity = Math.max(...snapshots.map((s) => s.liquidityUsd));
    const latest = snapshots[snapshots.length - 1];
    const priceCollapsed = peakPrice > 0 && latest.priceUsd / peakPrice < 0.1;
    const liquidityCollapsed = peakLiquidity > 0 && latest.liquidityUsd / peakLiquidity < 0.1;
    if (priceCollapsed || liquidityCollapsed) ruggedSet.add(mint);
  }
  return (mint: string) => ruggedSet.has(mint);
}

async function loadTraderTradesForWallet(walletAddress: string): Promise<TraderTrade[]> {
  const trades = await prisma.trade.findMany({
    where: { wallet: { address: walletAddress } },
    include: { token: true },
    orderBy: { occurredAt: "asc" },
  });
  return trades.map((t) => ({
    id: t.id,
    walletAddress,
    tokenMint: t.token.mintAddress,
    side: t.side,
    source: t.source,
    amountTokens: t.amountTokens ?? undefined,
    valueUsd: t.valueUsd ?? undefined,
    priceUsd: t.priceUsd ?? undefined,
    txSignature: t.txSignature ?? undefined,
    occurredAt: t.occurredAt.toISOString(),
  }));
}

/** Recomputes and persists trader stats for one wallet. */
export async function recomputeWalletStats(walletAddress: string): Promise<void> {
  const trades = await loadTraderTradesForWallet(walletAddress);
  if (trades.length === 0) return;

  const uniqueMints = [...new Set(trades.map((t) => t.tokenMint))];
  const isRug = await buildRugLookup(uniqueMints);
  const roundTrips = buildRoundTrips(trades, isRug);
  const stats = computeWalletStats({ walletAddress, roundTrips });

  await prisma.wallet.update({
    where: { address: walletAddress },
    data: {
      totalTrades: stats.totalTrades,
      winningTrades: stats.winningTrades,
      losingTrades: stats.losingTrades,
      winRate: stats.winRate,
      realizedPnlUsd: stats.realizedPnlUsd,
      unrealizedPnlUsd: stats.unrealizedPnlUsd,
      avgWinnerUsd: stats.avgWinnerUsd,
      avgLoserUsd: stats.avgLoserUsd,
      medianReturnPct: stats.medianReturnPct,
      profitFactor: stats.profitFactor,
      avgHoldTimeSec: stats.avgHoldTimeSec,
      medianHoldTimeSec: stats.medianHoldTimeSec,
      maxDrawdownPct: stats.maxDrawdownPct,
      rugsPurchased: stats.rugsPurchased,
      collapseRatePct: stats.collapseRatePct,
      consistencyScore: stats.consistencyScore,
      perf7dPct: stats.perf7dPct,
      perf30dPct: stats.perf30dPct,
      perfLifetimePct: stats.perfLifetimePct,
      traderScore: stats.traderScore,
      sampleSizeOk: stats.sampleSizeOk,
    },
  });

  const wallet = await prisma.wallet.findUnique({ where: { address: walletAddress } });
  if (wallet) {
    await prisma.walletScoreHistory.create({
      data: {
        walletId: wallet.id,
        traderScore: stats.traderScore,
        winRate: stats.winRate,
        realizedPnlUsd: stats.realizedPnlUsd,
      },
    });
  }
}

/** Recomputes stats for every wallet that has at least one recorded trade. */
export async function recomputeAllWalletStats(): Promise<{ processed: number }> {
  const wallets = await prisma.wallet.findMany({
    where: { trades: { some: {} } },
    select: { address: true },
  });
  for (const w of wallets) {
    await recomputeWalletStats(w.address);
  }
  return { processed: wallets.length };
}

/** Top-scoring wallets, requiring the minimum sample size by default. */
export async function getTopTraders(params: { limit?: number; requireSampleSizeOk?: boolean } = {}) {
  const { limit = 25, requireSampleSizeOk = true } = params;
  return prisma.wallet.findMany({
    where: requireSampleSizeOk ? { sampleSizeOk: true } : {},
    orderBy: { traderScore: "desc" },
    take: limit,
  });
}
