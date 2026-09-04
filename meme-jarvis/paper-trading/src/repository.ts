import { prisma, type PaperAccount } from "@meme-jarvis/database";
import { DEFAULT_PAPER_ACCOUNT, type PaperAccountSettings } from "@meme-jarvis/shared";
import { evaluateEntry, evaluateExit, simulateEntryFill, simulateExitFill } from "./engine.js";
import type { EntrySignal } from "./types.js";

async function accountToSettings(account: PaperAccount): Promise<PaperAccountSettings> {
  return {
    name: account.name,
    startingBalanceUsd: account.startingBalanceUsd,
    positionSizeUsd: account.positionSizeUsd,
    riskPerTradePct: account.riskPerTradePct,
    maxConcurrentPositions: account.maxConcurrentPositions,
    maxDailyLossUsd: account.maxDailyLossUsd,
    minOpportunityScore: account.minOpportunityScore,
    maxRiskScore: account.maxRiskScore,
    maxSlippagePct: account.maxSlippagePct,
    feeBps: account.feeBps,
    minLiquidityUsd: account.minLiquidityUsd,
    maxPumpBeforeEntryPct: account.maxPumpBeforeEntryPct,
    minStrongTraders: account.minStrongTraders,
    // Exit-rule percentages aren't columns on PaperAccount (they're strategy
    // constants, not account risk limits) — pull from env with sane defaults
    // so they're still config-driven without a schema migration per tweak.
    stopLossPct: Number(process.env.PAPER_STOP_LOSS_PCT ?? 20),
    takeProfit1Pct: Number(process.env.PAPER_TAKE_PROFIT_1_PCT ?? 25),
    takeProfit2Pct: Number(process.env.PAPER_TAKE_PROFIT_2_PCT ?? 60),
    takeProfit3Pct: Number(process.env.PAPER_TAKE_PROFIT_3_PCT ?? 150),
    trailingStopPct: Number(process.env.PAPER_TRAILING_STOP_PCT ?? 15),
    maxHoldTimeSec: Number(process.env.PAPER_MAX_HOLD_TIME_SEC ?? 6 * 60 * 60),
  };
}

export async function getOrCreateAccount(name = "default") {
  const existing = await prisma.paperAccount.findUnique({ where: { name } });
  if (existing) return existing;
  return prisma.paperAccount.create({
    data: {
      name,
      startingBalanceUsd: DEFAULT_PAPER_ACCOUNT.startingBalanceUsd,
      currentBalanceUsd: DEFAULT_PAPER_ACCOUNT.startingBalanceUsd,
      positionSizeUsd: DEFAULT_PAPER_ACCOUNT.positionSizeUsd,
      riskPerTradePct: DEFAULT_PAPER_ACCOUNT.riskPerTradePct,
      maxConcurrentPositions: DEFAULT_PAPER_ACCOUNT.maxConcurrentPositions,
      maxDailyLossUsd: DEFAULT_PAPER_ACCOUNT.maxDailyLossUsd,
      minOpportunityScore: DEFAULT_PAPER_ACCOUNT.minOpportunityScore,
      maxRiskScore: DEFAULT_PAPER_ACCOUNT.maxRiskScore,
      maxSlippagePct: DEFAULT_PAPER_ACCOUNT.maxSlippagePct,
      feeBps: DEFAULT_PAPER_ACCOUNT.feeBps,
      minLiquidityUsd: DEFAULT_PAPER_ACCOUNT.minLiquidityUsd,
      maxPumpBeforeEntryPct: DEFAULT_PAPER_ACCOUNT.maxPumpBeforeEntryPct,
      minStrongTraders: DEFAULT_PAPER_ACCOUNT.minStrongTraders,
    },
  });
}

async function realizedPnlToday(accountId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const trades = await prisma.paperTrade.findMany({
    where: { accountId, closedAt: { gte: startOfDay } },
    select: { pnlUsd: true },
  });
  return trades.reduce((s, t) => s + t.pnlUsd, 0);
}

/** Evaluates one signal against entry rules and opens a position if it passes. Returns the decision either way. */
export async function tryOpenPosition(accountName: string, signal: EntrySignal, signalSnapshot: unknown) {
  const account = await getOrCreateAccount(accountName);
  const settings = await accountToSettings(account);
  const openPositionsCount = await prisma.paperPosition.count({ where: { accountId: account.id, status: "OPEN" } });
  const realizedToday = await realizedPnlToday(account.id);

  const decision = evaluateEntry(signal, {
    settings,
    currentBalanceUsd: account.currentBalanceUsd,
    openPositionsCount,
    realizedPnlTodayUsd: realizedToday,
  });

  if (!decision.shouldEnter) return { opened: false, reason: decision.reason };

  const token = await prisma.token.findUnique({ where: { mintAddress: signal.tokenMint } });
  if (!token) return { opened: false, reason: "Token not found in database yet." };

  const fill = simulateEntryFill(settings.positionSizeUsd, signal.priceUsd, settings);

  const position = await prisma.paperPosition.create({
    data: {
      accountId: account.id,
      tokenId: token.id,
      entryPriceUsd: fill.fillPriceUsd,
      sizeUsd: settings.positionSizeUsd,
      tokensHeld: fill.tokensReceived,
      feesUsd: fill.feesUsd,
      slippagePct: settings.maxSlippagePct,
      stopLossPct: settings.stopLossPct,
      takeProfit1Pct: settings.takeProfit1Pct,
      takeProfit2Pct: settings.takeProfit2Pct,
      takeProfit3Pct: settings.takeProfit3Pct,
      trailingStopPct: settings.trailingStopPct,
      highWaterMarkUsd: fill.fillPriceUsd,
      entryReason: { text: decision.reason, signal } as unknown as object,
      signalSnapshot: signalSnapshot as object,
    },
  });

  await prisma.paperAccount.update({
    where: { id: account.id },
    data: { currentBalanceUsd: { decrement: settings.positionSizeUsd } },
  });

  return { opened: true, reason: decision.reason, position };
}

export interface PositionMarketContext {
  priceUsd: number;
  liquidityUsd?: number;
  riskScore?: number;
  smartWalletsStillHoldingRatioPct?: number;
}

/** Checks every open position for this account against exit rules and closes any that trigger. */
export async function tickOpenPositions(
  accountName: string,
  getMarketContext: (tokenMint: string) => Promise<PositionMarketContext | null>
) {
  const account = await getOrCreateAccount(accountName);
  const settings = await accountToSettings(account);
  const positions = await prisma.paperPosition.findMany({
    where: { accountId: account.id, status: "OPEN" },
    include: { token: true },
  });

  const closed: Array<{ tokenMint: string; reason: string }> = [];

  for (const position of positions) {
    const market = await getMarketContext(position.token.mintAddress);
    if (!market) continue;

    const decision = evaluateExit(
      {
        entryPriceUsd: position.entryPriceUsd,
        highWaterMarkUsd: position.highWaterMarkUsd,
        openedAtMs: position.openedAt.getTime(),
        settings,
      },
      {
        currentPriceUsd: market.priceUsd,
        currentLiquidityUsd: market.liquidityUsd,
        entryLiquidityUsd: (position.signalSnapshot as { liquidityUsd?: number } | null)?.liquidityUsd,
        currentRiskScore: market.riskScore,
        smartWalletsStillHoldingRatioPct: market.smartWalletsStillHoldingRatioPct,
        nowMs: Date.now(),
      }
    );

    if (decision.newHighWaterMarkUsd !== position.highWaterMarkUsd) {
      await prisma.paperPosition.update({
        where: { id: position.id },
        data: { highWaterMarkUsd: decision.newHighWaterMarkUsd },
      });
    }

    if (!decision.shouldExit || !decision.reason) continue;

    const fill = simulateExitFill(position.tokensHeld, market.priceUsd, settings);
    const pnlUsd = fill.tokensReceived - position.sizeUsd;
    const returnPct = (pnlUsd / position.sizeUsd) * 100;
    const holdTimeSec = Math.round((Date.now() - position.openedAt.getTime()) / 1000);

    const snapshotsDuringTrade = await prisma.tokenSnapshot.findMany({
      where: { tokenId: position.tokenId, recordedAt: { gte: position.openedAt } },
      select: { priceUsd: true },
    });
    const pricesSeen = [position.entryPriceUsd, ...snapshotsDuringTrade.map((s) => s.priceUsd), market.priceUsd];
    const maxPriceSeen = Math.max(...pricesSeen);
    const minPriceSeen = Math.min(...pricesSeen);
    const mfePct = ((maxPriceSeen - position.entryPriceUsd) / position.entryPriceUsd) * 100;
    const maePct = ((minPriceSeen - position.entryPriceUsd) / position.entryPriceUsd) * 100;

    await prisma.$transaction([
      prisma.paperTrade.create({
        data: {
          accountId: account.id,
          tokenId: position.tokenId,
          entryPriceUsd: position.entryPriceUsd,
          exitPriceUsd: fill.fillPriceUsd,
          sizeUsd: position.sizeUsd,
          feesUsd: position.feesUsd + fill.feesUsd,
          slippagePct: settings.maxSlippagePct,
          pnlUsd,
          returnPct,
          maxFavorableExcursionPct: mfePct,
          maxAdverseExcursionPct: maePct,
          entryReason: position.entryReason as object,
          exitReason: decision.reason,
          exitReasonDetail: decision.detail,
          signalSnapshotEntry: position.signalSnapshot as object,
          signalSnapshotExit: market as unknown as object,
          holdTimeSec,
          openedAt: position.openedAt,
        },
      }),
      prisma.paperPosition.update({ where: { id: position.id }, data: { status: "CLOSED" } }),
      prisma.paperAccount.update({
        where: { id: account.id },
        data: { currentBalanceUsd: { increment: fill.tokensReceived } },
      }),
    ]);

    closed.push({ tokenMint: position.token.mintAddress, reason: `${decision.reason}: ${decision.detail ?? ""}` });
  }

  return { closed };
}
