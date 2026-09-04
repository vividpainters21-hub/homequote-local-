import { prisma } from "@meme-jarvis/database";

function mean(values: number[]): number {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

function maxDrawdownFromPnlSeries(pnlSeries: number[]): number {
  let cumulative = 0;
  let peak = 0;
  let maxDd = 0;
  for (const pnl of pnlSeries) {
    cumulative += pnl;
    peak = Math.max(peak, cumulative);
    maxDd = Math.max(maxDd, peak - cumulative);
  }
  return maxDd;
}

interface BucketStats {
  bucket: string;
  trades: number;
  winRate: number;
  avgReturnPct: number;
  totalPnlUsd: number;
}

function bucketBy<T>(trades: T[], keyFn: (t: T) => string, pnlFn: (t: T) => number, returnFn: (t: T) => number): BucketStats[] {
  const groups = new Map<string, T[]>();
  for (const t of trades) {
    const key = keyFn(t);
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }
  return [...groups.entries()].map(([bucket, arr]) => ({
    bucket,
    trades: arr.length,
    winRate: (arr.filter((t) => pnlFn(t) > 0).length / arr.length) * 100,
    avgReturnPct: mean(arr.map(returnFn)),
    totalPnlUsd: arr.reduce((s, t) => s + pnlFn(t), 0),
  }));
}

function scoreRangeBucket(score: number | undefined): string {
  if (score === undefined) return "unknown";
  if (score >= 90) return "90-100";
  if (score >= 80) return "80-89";
  if (score >= 70) return "70-79";
  if (score >= 60) return "60-69";
  return "<60";
}

function ageBucketFromMs(ageSec: number | undefined): string {
  if (ageSec === undefined) return "unknown";
  const min = ageSec / 60;
  if (min < 15) return "0-15m";
  if (min < 60) return "15-60m";
  if (min < 240) return "1-4h";
  if (min < 1440) return "4-24h";
  return "24h+";
}

function liquidityBucket(liq: number | undefined): string {
  if (liq === undefined) return "unknown";
  if (liq < 15_000) return "<15k";
  if (liq < 50_000) return "15k-50k";
  if (liq < 150_000) return "50k-150k";
  if (liq < 500_000) return "150k-500k";
  return "500k+";
}

function traderCountBucket(count: number | undefined): string {
  if (count === undefined) return "unknown";
  if (count < 3) return "0-2";
  if (count < 5) return "3-4";
  if (count < 8) return "5-7";
  return "8+";
}

function hourBucket(date: Date): string {
  return `${date.getUTCHours().toString().padStart(2, "0")}:00 UTC`;
}

/**
 * Full Phase 11 performance analytics for one paper account, computed
 * directly from PaperTrade rows (each of which stores its full entry signal
 * snapshot, so we can slice performance by score range, token age,
 * liquidity, smart-wallet count, etc. without re-deriving anything).
 */
export async function computeAnalytics(accountName = "default") {
  const account = await prisma.paperAccount.findUnique({ where: { name: accountName } });
  if (!account) return null;

  const trades = await prisma.paperTrade.findMany({
    where: { accountId: account.id },
    orderBy: { closedAt: "asc" },
    include: { token: true },
  });

  const totalTrades = trades.length;
  const wins = trades.filter((t) => t.pnlUsd > 0);
  const losses = trades.filter((t) => t.pnlUsd <= 0);
  const winRate = totalTrades ? (wins.length / totalTrades) * 100 : 0;
  const avgWinner = mean(wins.map((t) => t.pnlUsd));
  const avgLoser = mean(losses.map((t) => t.pnlUsd));
  const grossProfit = wins.reduce((s, t) => s + t.pnlUsd, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlUsd, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const totalPnlUsd = trades.reduce((s, t) => s + t.pnlUsd, 0);
  const roi = account.startingBalanceUsd > 0 ? (totalPnlUsd / account.startingBalanceUsd) * 100 : 0;
  const expectancy = totalTrades ? totalPnlUsd / totalTrades : 0;
  const maxDrawdownUsd = maxDrawdownFromPnlSeries(trades.map((t) => t.pnlUsd));
  const returnStdDev = stdDev(trades.map((t) => t.returnPct));
  const sharpeLike = returnStdDev > 0 ? mean(trades.map((t) => t.returnPct)) / returnStdDev : 0;
  const avgHoldTimeSec = Math.round(mean(trades.map((t) => t.holdTimeSec)));

  const withEntrySignal = trades.map((t) => ({
    ...t,
    _signal: t.signalSnapshotEntry as {
      opportunityScore?: number;
      liquidityUsd?: number;
      strongTraderCount?: number;
    } | null,
  }));

  const byScoreRange = bucketBy(
    withEntrySignal,
    (t) => scoreRangeBucket(t._signal?.opportunityScore),
    (t) => t.pnlUsd,
    (t) => t.returnPct
  );

  const byTokenAge = bucketBy(
    trades,
    (t) => ageBucketFromMs(t.token.tokenCreatedAt ? (t.openedAt.getTime() - t.token.tokenCreatedAt.getTime()) / 1000 : undefined),
    (t) => t.pnlUsd,
    (t) => t.returnPct
  );

  const byLiquidity = bucketBy(
    withEntrySignal,
    (t) => liquidityBucket(t._signal?.liquidityUsd),
    (t) => t.pnlUsd,
    (t) => t.returnPct
  );

  const bySmartWalletCount = bucketBy(
    withEntrySignal,
    (t) => traderCountBucket(t._signal?.strongTraderCount),
    (t) => t.pnlUsd,
    (t) => t.returnPct
  );

  const byTimeOfDay = bucketBy(
    trades,
    (t) => hourBucket(t.openedAt),
    (t) => t.pnlUsd,
    (t) => t.returnPct
  );

  const byExitStrategy = bucketBy(
    trades,
    (t) => t.exitReason,
    (t) => t.pnlUsd,
    (t) => t.returnPct
  );

  return {
    accountName,
    currentBalanceUsd: account.currentBalanceUsd,
    startingBalanceUsd: account.startingBalanceUsd,
    totalTrades,
    wins: wins.length,
    losses: losses.length,
    winRate,
    avgWinnerUsd: avgWinner,
    avgLoserUsd: avgLoser,
    profitFactor,
    expectancyUsd: expectancy,
    totalPnlUsd,
    roiPct: roi,
    maxDrawdownUsd,
    sharpeLike,
    avgHoldTimeSec,
    byScoreRange,
    byTokenAge,
    byLiquidity,
    bySmartWalletCount,
    byTimeOfDay,
    byExitStrategy,
  };
}
