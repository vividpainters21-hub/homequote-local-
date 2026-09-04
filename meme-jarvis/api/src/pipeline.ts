import { prisma } from "@meme-jarvis/database";
import { getMergedTokenSnapshot } from "@meme-jarvis/market-data";
import { buildSecurityInfo, canSellToken, getMintSecurityInfo } from "@meme-jarvis/solana";
import { assessRisk, type RiskEngineInput } from "@meme-jarvis/risk-engine";
import type { TokenSecurityInfo } from "@meme-jarvis/shared";
import { computeOpportunityScore, getActiveWeights, type OpportunityInput } from "@meme-jarvis/scoring-engine";
import { detectClusters } from "@meme-jarvis/cluster-engine";
import { recomputeAllWalletStats } from "@meme-jarvis/wallet-intelligence";
import { tryOpenPosition, tickOpenPositions, type PositionMarketContext } from "@meme-jarvis/paper-trading";
import { dispatchAlert, formatHighScore, formatPaperEntry, formatPaperExit, formatRugWarning, formatSmartMoneyCluster, formatWhaleDump } from "@meme-jarvis/alerts";
import type { ClusterCandidate, TraderEntry } from "@meme-jarvis/shared";

const STRONG_TRADER_SCORE = Number(process.env.STRONG_TRADER_SCORE ?? 60);
const HIGH_SCORE_ALERT_THRESHOLD = Number(process.env.HIGH_SCORE_ALERT_THRESHOLD ?? 90);
const STRONG_CLUSTER_ALERT_THRESHOLD = Number(process.env.STRONG_CLUSTER_ALERT_THRESHOLD ?? 70);
const RAPID_SCORE_JUMP = Number(process.env.RAPID_SCORE_JUMP ?? 15);
const WALLET_RECOMPUTE_EVERY_N_TICKS = Number(process.env.WALLET_RECOMPUTE_EVERY_N_TICKS ?? 10);

interface SecurityCacheEntry {
  data: TokenSecurityInfo;
  sellTestPassed: boolean | undefined;
  expiresAt: number;
}
const securityCache = new Map<string, SecurityCacheEntry>();
const SECURITY_CACHE_TTL_MS = 10 * 60 * 1000;

async function getCachedSecurityInfo(mint: string, deployerAddress?: string): Promise<SecurityCacheEntry> {
  const cached = securityCache.get(mint);
  if (cached && cached.expiresAt > Date.now()) return cached;

  let data: TokenSecurityInfo = {};
  let sellTestPassed: boolean | undefined;
  try {
    data = await buildSecurityInfo(mint, deployerAddress);
    const { decimals } = await getMintSecurityInfo(mint);
    // Test selling a small nominal amount (1 unit) to confirm a route exists.
    sellTestPassed = await canSellToken(mint, String(10 ** decimals));
  } catch {
    // On-chain lookups can fail for very new / malformed tokens — treat as unknown, not disqualifying.
    sellTestPassed = undefined;
  }

  const entry: SecurityCacheEntry = { data, sellTestPassed, expiresAt: Date.now() + SECURITY_CACHE_TTL_MS };
  securityCache.set(mint, entry);
  return entry;
}

async function getActiveTokenMints(): Promise<string[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const tokens = await prisma.token.findMany({
    where: { trades: { some: { occurredAt: { gte: since } } } },
    select: { mintAddress: true },
  });
  return tokens.map((t) => t.mintAddress);
}

let tickCount = 0;

/** Runs one full pass of the Meme Jarvis pipeline: market data -> risk -> scoring -> clusters -> paper trading. */
export async function runPipelineTick(): Promise<{ tokensProcessed: number }> {
  tickCount++;
  const mints = await getActiveTokenMints();
  const marketContextByMint = new Map<string, PositionMarketContext>();
  const weights = await getActiveWeights().catch(() => undefined);

  for (const mint of mints) {
    const token = await prisma.token.findUnique({ where: { mintAddress: mint } });
    if (!token) continue;

    const snapshot = await getMergedTokenSnapshot(mint).catch(() => null);
    if (!snapshot || snapshot.priceUsd <= 0) continue;

    const previousSnapshot = await prisma.tokenSnapshot.findFirst({
      where: { tokenId: token.id },
      orderBy: { recordedAt: "desc" },
    });
    const earliestSnapshot = await prisma.tokenSnapshot.findFirst({
      where: { tokenId: token.id },
      orderBy: { recordedAt: "asc" },
    });

    await prisma.tokenSnapshot.create({
      data: {
        tokenId: token.id,
        priceUsd: snapshot.priceUsd,
        liquidityUsd: snapshot.liquidityUsd,
        marketCapUsd: snapshot.marketCapUsd,
        fdvUsd: snapshot.fdvUsd,
        volume1mUsd: snapshot.volume1mUsd,
        volume5mUsd: snapshot.volume5mUsd,
        volume15mUsd: snapshot.volume15mUsd,
        volume1hUsd: snapshot.volume1hUsd,
        buyCount5m: snapshot.buyCount5m,
        sellCount5m: snapshot.sellCount5m,
        uniqueBuyers5m: snapshot.uniqueBuyers5m,
        uniqueSellers5m: snapshot.uniqueSellers5m,
        priceChange5mPct: snapshot.priceChange5mPct,
        priceChange1hPct: snapshot.priceChange1hPct,
        liquidityChangePct: previousSnapshot
          ? ((snapshot.liquidityUsd - previousSnapshot.liquidityUsd) / Math.max(previousSnapshot.liquidityUsd, 1)) * 100
          : undefined,
      },
    });

    if (!token.tokenCreatedAt && snapshot.tokenAgeSec !== undefined) {
      await prisma.token.update({
        where: { id: token.id },
        data: { tokenCreatedAt: new Date(Date.now() - snapshot.tokenAgeSec * 1000) },
      });
    }

    const security = await getCachedSecurityInfo(mint, token.deployerAddress ?? undefined);

    // --- Strong-trader trade window (last 6h) for clustering + smart money counts ---
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const recentTrades = await prisma.trade.findMany({
      where: { tokenId: token.id, occurredAt: { gte: sixHoursAgo } },
      include: { wallet: true },
      orderBy: { occurredAt: "asc" },
    });
    const strongTrades = recentTrades.filter((t) => t.wallet.sampleSizeOk && t.wallet.traderScore >= STRONG_TRADER_SCORE);

    const entries: TraderEntry[] = strongTrades.map((t) => ({
      walletAddress: t.wallet.address,
      traderScore: t.wallet.traderScore,
      winRate: t.wallet.winRate,
      amountUsd: t.valueUsd ?? 0,
      side: t.side,
      occurredAt: t.occurredAt.toISOString(),
    }));

    const candidate: ClusterCandidate = {
      tokenMint: mint,
      entries,
      priceAtFirstEntryUsd: earliestSnapshot?.priceUsd,
      priceNowUsd: snapshot.priceUsd,
    };

    const clusters = detectClusters(candidate);
    const strongestCluster = clusters[0] ?? null;

    if (strongestCluster) {
      const alreadyRecorded = await prisma.cluster.findFirst({
        where: { tokenId: token.id, firstEntryAt: new Date(strongestCluster.firstEntryAt), lastEntryAt: new Date(strongestCluster.lastEntryAt) },
      });
      if (!alreadyRecorded) {
        const clusterRow = await prisma.cluster.create({
          data: {
            tokenId: token.id,
            windowSeconds: strongestCluster.windowSeconds,
            memberCount: strongestCluster.memberCount,
            avgTraderScore: strongestCluster.avgTraderScore,
            avgWinRatePct: strongestCluster.avgWinRatePct,
            totalAmountUsd: strongestCluster.totalAmountUsd,
            buyingAccelerationPerMin: strongestCluster.buyingAccelerationPerMin,
            stillHoldingCount: strongestCluster.stillHoldingCount,
            exitingCount: strongestCluster.exitingCount,
            priceChangeSincePct: strongestCluster.priceChangeSincePct ?? undefined,
            clusterScore: strongestCluster.clusterScore,
            firstEntryAt: new Date(strongestCluster.firstEntryAt),
            lastEntryAt: new Date(strongestCluster.lastEntryAt),
          },
        });

        if (strongestCluster.clusterScore >= STRONG_CLUSTER_ALERT_THRESHOLD) {
          await dispatchAlert({
            category: "SMART_MONEY_CLUSTER",
            tokenId: token.id,
            clusterId: clusterRow.id,
            message: formatSmartMoneyCluster({
              symbol: token.symbol ?? mint.slice(0, 6),
              opportunityScore: 0, // filled in below once computed; cluster alert doesn't block on it
              riskScore: 0,
              memberCount: strongestCluster.memberCount,
              windowSeconds: strongestCluster.windowSeconds,
              avgTraderScore: strongestCluster.avgTraderScore,
              liquidityUsd: snapshot.liquidityUsd,
              volume5mChangePct: undefined,
              buySellRatio: snapshot.sellCount5m ? (snapshot.buyCount5m ?? 0) / snapshot.sellCount5m : undefined,
              priceChangeSincePct: strongestCluster.priceChangeSincePct,
              status: "STRONG WATCH",
            }),
            payload: strongestCluster as unknown as object,
          });
        }
      }
    }

    // --- Whale dump detection (any single sell > 10% of current liquidity in last 15m) ---
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const bigSell = recentTrades
      .filter((t) => t.side === "SELL" && t.occurredAt >= fifteenMinAgo && (t.valueUsd ?? 0) > snapshot.liquidityUsd * 0.1)
      .sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0))[0];

    const strongBuyers15m = strongTrades.filter((t) => t.side === "BUY" && t.occurredAt >= fifteenMinAgo);
    const strongSellers15m = strongTrades.filter((t) => t.side === "SELL" && t.occurredAt >= fifteenMinAgo);
    const strongBuyerWallets = [...new Set(strongBuyers15m.map((t) => t.wallet.address))];
    const strongSellerWallets = new Set(strongSellers15m.map((t) => t.wallet.address));
    const stillHoldingAmongBuyers = strongBuyerWallets.filter((w) => !strongSellerWallets.has(w));
    const smartWalletsHoldingRatioPct =
      strongBuyerWallets.length > 0 ? (stillHoldingAmongBuyers.length / strongBuyerWallets.length) * 100 : undefined;

    const alreadyPumpedPct = earliestSnapshot && earliestSnapshot.priceUsd > 0
      ? ((snapshot.priceUsd - earliestSnapshot.priceUsd) / earliestSnapshot.priceUsd) * 100
      : 0;

    // --- Risk assessment ---
    const riskInput: RiskEngineInput = {
      ...snapshot,
      ...security.data,
      sellTestPassed: security.sellTestPassed,
      alreadyPumpedPct,
      whaleDumpDetectedRecently: Boolean(bigSell),
      smartWalletsExitingCount: strongSellerWallets.size,
      smartWalletsHoldingCount: stillHoldingAmongBuyers.length,
    };
    const risk = assessRisk(riskInput);

    await prisma.riskAssessment.create({
      data: {
        tokenId: token.id,
        riskScore: risk.riskScore,
        criticalDisqualified: risk.criticalDisqualified,
        flags: risk.flags as unknown as object,
      },
    });

    if (risk.criticalDisqualified) {
      await dispatchAlert({
        category: "RUG_WARNING",
        tokenId: token.id,
        message: formatRugWarning({
          symbol: token.symbol ?? mint.slice(0, 6),
          flags: risk.flags.filter((f) => f.severity === "critical").map((f) => f.message),
        }),
        payload: risk as unknown as object,
      });
    }
    if (bigSell) {
      await dispatchAlert({
        category: "WHALE_DUMP",
        tokenId: token.id,
        message: formatWhaleDump({ symbol: token.symbol ?? mint.slice(0, 6), walletAddress: bigSell.wallet.address, valueUsd: bigSell.valueUsd ?? 0 }),
      });
    }

    // --- Opportunity scoring ---
    const opportunityInput: OpportunityInput = {
      market: snapshot,
      smartWalletsBuying: strongBuyerWallets.length,
      smartWalletsSelling: strongSellerWallets.size,
      avgTraderScoreOfBuyers: strongBuyers15m.length
        ? strongBuyers15m.reduce((s, t) => s + t.wallet.traderScore, 0) / strongBuyers15m.length
        : 0,
      volumePrev5mUsd: previousSnapshot?.volume5mUsd ?? undefined,
      uniqueBuyers5mPrev: previousSnapshot?.uniqueBuyers5m ?? undefined,
      holderConcentrationPct: security.data.top10HolderPct,
      alreadyPumpedPct,
      smartWalletsHoldingRatioPct,
      clusterScore: strongestCluster?.clusterScore,
      riskCriticalDisqualified: risk.criticalDisqualified,
    };
    const opportunity = computeOpportunityScore(opportunityInput, weights);

    const previousOpportunity = await prisma.opportunityScore.findFirst({
      where: { tokenId: token.id },
      orderBy: { computedAt: "desc" },
    });

    await prisma.opportunityScore.create({
      data: {
        tokenId: token.id,
        score: opportunity.score,
        breakdown: opportunity.breakdown as unknown as object,
        reasons: opportunity.reasons as unknown as object,
        warnings: opportunity.warnings as unknown as object,
        status: opportunity.status,
      },
    });

    if (previousOpportunity && opportunity.score - previousOpportunity.score >= RAPID_SCORE_JUMP) {
      await dispatchAlert({
        category: "RAPID_SCORE_INCREASE",
        tokenId: token.id,
        message: `📈 <b>RAPID SCORE INCREASE</b>\nToken: <b>${token.symbol ?? mint.slice(0, 6)}</b>\nScore moved ${previousOpportunity.score.toFixed(0)} → ${opportunity.score.toFixed(0)}.`,
      });
    }

    if (opportunity.status === "HIGH_QUALITY_SETUP" && opportunity.score >= HIGH_SCORE_ALERT_THRESHOLD) {
      const recentHighScoreAlert = await prisma.alert.findFirst({
        where: { tokenId: token.id, category: "HIGH_SCORE", createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
      });
      if (!recentHighScoreAlert) {
        await dispatchAlert({
          category: "HIGH_SCORE",
          tokenId: token.id,
          message: formatHighScore({
            symbol: token.symbol ?? mint.slice(0, 6),
            opportunityScore: opportunity.score,
            riskScore: risk.riskScore,
            reasons: opportunity.reasons,
          }),
        });
      }
    }

    marketContextByMint.set(mint, {
      priceUsd: snapshot.priceUsd,
      liquidityUsd: snapshot.liquidityUsd,
      riskScore: risk.riskScore,
      smartWalletsStillHoldingRatioPct: smartWalletsHoldingRatioPct,
    });

    // --- Paper trading entry ---
    const paperResult = await tryOpenPosition(
      "default",
      {
        tokenMint: mint,
        opportunityScore: opportunity.score,
        riskScore: risk.riskScore,
        riskCriticalDisqualified: risk.criticalDisqualified,
        liquidityUsd: snapshot.liquidityUsd,
        strongTraderCount: strongBuyerWallets.length,
        alreadyPumpedPct,
        priceUsd: snapshot.priceUsd,
      },
      {
        liquidityUsd: snapshot.liquidityUsd,
        opportunityScore: opportunity.score,
        riskScore: risk.riskScore,
        strongTraderCount: strongBuyerWallets.length,
      }
    );
    if (paperResult.opened) {
      await dispatchAlert({
        category: "PAPER_ENTRY",
        tokenId: token.id,
        message: formatPaperEntry({
          symbol: token.symbol ?? mint.slice(0, 6),
          sizeUsd: paperResult.position?.sizeUsd ?? 0,
          entryPriceUsd: paperResult.position?.entryPriceUsd ?? snapshot.priceUsd,
          reason: paperResult.reason,
        }),
      });
    }
  }

  // --- Exit checks for all open paper positions ---
  const { closed } = await tickOpenPositions("default", async (mint) => marketContextByMint.get(mint) ?? null);
  for (const c of closed) {
    const token = await prisma.token.findUnique({ where: { mintAddress: c.tokenMint } });
    const lastTrade = await prisma.paperTrade.findFirst({ where: { token: { mintAddress: c.tokenMint } }, orderBy: { closedAt: "desc" } });
    if (lastTrade) {
      await dispatchAlert({
        category: "PAPER_EXIT",
        tokenId: token?.id,
        message: formatPaperExit({
          symbol: token?.symbol ?? c.tokenMint.slice(0, 6),
          pnlUsd: lastTrade.pnlUsd,
          returnPct: lastTrade.returnPct,
          reason: c.reason,
        }),
      });
    }
  }

  if (tickCount % WALLET_RECOMPUTE_EVERY_N_TICKS === 0) {
    await recomputeAllWalletStats().catch(() => undefined);
  }

  return { tokensProcessed: mints.length };
}

export function startPipelineLoop(
  intervalMs = Number(process.env.PIPELINE_INTERVAL_MS ?? 30_000),
  onTick?: (result: { tokensProcessed: number }) => void
) {
  const run = () => {
    runPipelineTick()
      .then((result) => onTick?.(result))
      .catch((err) => console.error("[pipeline] tick failed:", err));
  };
  run();
  return setInterval(run, intervalMs);
}
