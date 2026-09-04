import type { ClusterCandidate, ClusterResult, TraderEntry } from "@meme-jarvis/shared";

export interface ClusterTier {
  windowSeconds: number;
  minMembers: number;
}

/** Phase 4 examples: 3 strong traders in 60s, 5 in 3min, 8 in 10min. */
export const DEFAULT_CLUSTER_TIERS: ClusterTier[] = [
  { windowSeconds: 60, minMembers: 3 },
  { windowSeconds: 180, minMembers: 5 },
  { windowSeconds: 600, minMembers: 8 },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function computeClusterScore(params: {
  memberCount: number;
  avgTraderScore: number;
  avgWinRatePct: number;
  windowSeconds: number;
  stillHoldingCount: number;
  exitingCount: number;
  priceChangeSincePct: number | null;
}): number {
  const memberCountScore = clamp(params.memberCount * 10, 0, 100);
  const speedScore = clamp(100 - (params.windowSeconds / 600) * 100, 0, 100);
  const totalTracked = params.stillHoldingCount + params.exitingCount;
  const holdingRatio = totalTracked > 0 ? (params.stillHoldingCount / totalTracked) * 100 : 50;
  const priceComponent =
    params.priceChangeSincePct === null ? 50 : clamp(50 + params.priceChangeSincePct, 0, 100);

  const score =
    0.25 * memberCountScore +
    0.2 * clamp(params.avgTraderScore, 0, 100) +
    0.15 * clamp(params.avgWinRatePct, 0, 100) +
    0.15 * speedScore +
    0.15 * holdingRatio +
    0.1 * priceComponent;

  return clamp(score, 0, 100);
}

/**
 * Detects smart-money entry clusters for one token. `candidate.entries` must
 * already be filtered to trades from wallets that clear the trader-score bar
 * (the caller decides that threshold, e.g. traderScore >= 60) — this engine
 * only measures timing/coordination, not who counts as "strong".
 */
export function detectClusters(
  candidate: ClusterCandidate,
  tiers: ClusterTier[] = DEFAULT_CLUSTER_TIERS
): ClusterResult[] {
  const buys = candidate.entries
    .filter((e) => e.side === "BUY")
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  const sells = candidate.entries.filter((e) => e.side === "SELL");

  const results: ClusterResult[] = [];

  for (const tier of tiers) {
    for (let i = 0; i < buys.length; i++) {
      const windowStartMs = new Date(buys[i].occurredAt).getTime();
      const windowEndMs = windowStartMs + tier.windowSeconds * 1000;
      const windowEntries: TraderEntry[] = [];
      let j = i;
      while (j < buys.length && new Date(buys[j].occurredAt).getTime() <= windowEndMs) {
        windowEntries.push(buys[j]);
        j++;
      }

      const uniqueWallets = [...new Map(windowEntries.map((e) => [e.walletAddress, e])).values()];
      if (uniqueWallets.length < tier.minMembers) continue;

      const totalAmountUsd = windowEntries.reduce((s, e) => s + e.amountUsd, 0);
      const avgTraderScore = mean(uniqueWallets.map((e) => e.traderScore));
      const avgWinRatePct = mean(uniqueWallets.map((e) => e.winRate));
      const firstEntryAt = windowEntries[0].occurredAt;
      const lastEntryAt = windowEntries[windowEntries.length - 1].occurredAt;
      const durationMin = Math.max(
        1 / 60,
        (new Date(lastEntryAt).getTime() - new Date(firstEntryAt).getTime()) / 60000
      );
      const buyingAccelerationPerMin = uniqueWallets.length / durationMin;

      let stillHoldingCount = 0;
      let exitingCount = 0;
      for (const w of uniqueWallets) {
        const hasExited = sells.some(
          (s) => s.walletAddress === w.walletAddress && new Date(s.occurredAt) > new Date(w.occurredAt)
        );
        if (hasExited) exitingCount++;
        else stillHoldingCount++;
      }

      const priceChangeSincePct =
        candidate.priceAtFirstEntryUsd && candidate.priceNowUsd
          ? ((candidate.priceNowUsd - candidate.priceAtFirstEntryUsd) / candidate.priceAtFirstEntryUsd) * 100
          : null;

      const clusterScore = computeClusterScore({
        memberCount: uniqueWallets.length,
        avgTraderScore,
        avgWinRatePct,
        windowSeconds: tier.windowSeconds,
        stillHoldingCount,
        exitingCount,
        priceChangeSincePct,
      });

      results.push({
        tokenMint: candidate.tokenMint,
        windowSeconds: tier.windowSeconds,
        memberCount: uniqueWallets.length,
        avgTraderScore,
        avgWinRatePct,
        totalAmountUsd,
        buyingAccelerationPerMin,
        stillHoldingCount,
        exitingCount,
        priceChangeSincePct,
        clusterScore,
        firstEntryAt,
        lastEntryAt,
        members: uniqueWallets.map((w) => w.walletAddress),
      });

      // Advance past this window so we don't emit heavily overlapping duplicates for the same tier.
      i = j - 1;
    }
  }

  return results.sort((a, b) => b.clusterScore - a.clusterScore);
}

/** Convenience: the single strongest cluster across all tiers, if any triggered. */
export function findStrongestCluster(
  candidate: ClusterCandidate,
  tiers: ClusterTier[] = DEFAULT_CLUSTER_TIERS
): ClusterResult | null {
  const all = detectClusters(candidate, tiers);
  return all[0] ?? null;
}
