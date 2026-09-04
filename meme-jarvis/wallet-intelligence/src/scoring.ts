import type { WalletStats, WalletStatsInput } from "@meme-jarvis/shared";

/** Below this many closed round trips, we don't trust the sample — one lucky
 * trade should never make a trader look elite. Score is shrunk toward zero
 * proportionally to how far below this threshold the sample is. */
export const MIN_SAMPLE_SIZE = 15;

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Maps a percentage return to a 0-100 "goodness" score via a soft clamp. */
function normalizePct(pct: number): number {
  return clamp(50 + pct / 2, 0, 100);
}

/**
 * Splits round trips (already sorted by exit time) into N chronological
 * buckets and returns the standard deviation of each bucket's win rate.
 * Low variance across buckets = consistent performer, not a one-hit wonder.
 */
function bucketedWinRateStdDev(sortedByExit: { pnlUsd: number }[], buckets = 4): number {
  if (sortedByExit.length < buckets * 2) return 0; // not enough data to bucket meaningfully
  const size = Math.ceil(sortedByExit.length / buckets);
  const winRates: number[] = [];
  for (let i = 0; i < sortedByExit.length; i += size) {
    const chunk = sortedByExit.slice(i, i + size);
    if (chunk.length === 0) continue;
    const wins = chunk.filter((c) => c.pnlUsd > 0).length;
    winRates.push((wins / chunk.length) * 100);
  }
  return stdDev(winRates);
}

function maxDrawdownPct(sortedByExit: { pnlUsd: number }[]): number {
  if (sortedByExit.length === 0) return 0;
  let cumulative = 0;
  let peak = 0;
  let maxDd = 0;
  for (const rt of sortedByExit) {
    cumulative += rt.pnlUsd;
    peak = Math.max(peak, cumulative);
    const drawdown = peak - cumulative;
    // Express drawdown relative to peak, or to total absolute swing if peak is ~0
    const denom = Math.max(peak, 1);
    maxDd = Math.max(maxDd, (drawdown / denom) * 100);
  }
  return clamp(maxDd, 0, 100);
}

export function computeWalletStats(input: WalletStatsInput): WalletStats {
  const now = input.now ?? new Date();
  const roundTrips = [...input.roundTrips].sort(
    (a, b) => new Date(a.exitedAt).getTime() - new Date(b.exitedAt).getTime()
  );

  const totalTrades = roundTrips.length;
  const winners = roundTrips.filter((r) => r.pnlUsd > 0);
  const losers = roundTrips.filter((r) => r.pnlUsd <= 0);
  const winningTrades = winners.length;
  const losingTrades = losers.length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  const realizedPnlUsd = roundTrips.reduce((s, r) => s + r.pnlUsd, 0);
  const unrealizedPnlUsd = input.openPositionsUnrealizedPnlUsd ?? 0;
  const avgWinnerUsd = mean(winners.map((r) => r.pnlUsd));
  const avgLoserUsd = mean(losers.map((r) => r.pnlUsd));
  const medianReturnPct = median(roundTrips.map((r) => r.returnPct));

  const grossProfit = winners.reduce((s, r) => s + r.pnlUsd, 0);
  const grossLoss = Math.abs(losers.reduce((s, r) => s + r.pnlUsd, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 10 : 0;

  const avgHoldTimeSec = Math.round(mean(roundTrips.map((r) => r.holdTimeSec)));
  const medianHoldTimeSec = Math.round(median(roundTrips.map((r) => r.holdTimeSec)));

  const drawdown = maxDrawdownPct(roundTrips);

  const rugsPurchased = roundTrips.filter((r) => r.wasRug).length;
  const collapseRatePct = totalTrades > 0 ? (rugsPurchased / totalTrades) * 100 : 0;

  const winRateVariance = bucketedWinRateStdDev(roundTrips);
  const consistencyScore = clamp(100 - winRateVariance * 1.5, 0, 100);

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const windowPerf = (since: Date) => {
    const inWindow = roundTrips.filter((r) => new Date(r.exitedAt) >= since);
    const capital = inWindow.reduce((s, r) => s + r.entryValueUsd, 0);
    const pnl = inWindow.reduce((s, r) => s + r.pnlUsd, 0);
    return capital > 0 ? (pnl / capital) * 100 : 0;
  };

  const perf7dPct = windowPerf(sevenDaysAgo);
  const perf30dPct = windowPerf(thirtyDaysAgo);
  const lifetimeCapital = roundTrips.reduce((s, r) => s + r.entryValueUsd, 0);
  const perfLifetimePct = lifetimeCapital > 0 ? (realizedPnlUsd / lifetimeCapital) * 100 : 0;

  const winRateScore = clamp(winRate, 0, 100);
  const profitFactorScore = clamp(profitFactor * 20, 0, 100);
  const drawdownScore = clamp(100 - drawdown, 0, 100);
  const recencyBlend =
    0.5 * normalizePct(perf7dPct) + 0.3 * normalizePct(perf30dPct) + 0.2 * normalizePct(perfLifetimePct);
  const rugPenalty = collapseRatePct * 0.5;

  const rawScore =
    0.3 * winRateScore +
    0.2 * profitFactorScore +
    0.15 * consistencyScore +
    0.15 * drawdownScore +
    0.2 * recencyBlend -
    rugPenalty;

  const sampleSizeOk = totalTrades >= MIN_SAMPLE_SIZE;
  const shrinkage = clamp(totalTrades / MIN_SAMPLE_SIZE, 0, 1);
  const traderScore = clamp(rawScore * shrinkage, 0, 100);

  return {
    walletAddress: input.walletAddress,
    totalTrades,
    winningTrades,
    losingTrades,
    winRate,
    realizedPnlUsd,
    unrealizedPnlUsd,
    avgWinnerUsd,
    avgLoserUsd,
    medianReturnPct,
    profitFactor,
    avgHoldTimeSec,
    medianHoldTimeSec,
    maxDrawdownPct: drawdown,
    rugsPurchased,
    collapseRatePct,
    consistencyScore,
    perf7dPct,
    perf30dPct,
    perfLifetimePct,
    traderScore,
    sampleSizeOk,
  };
}
