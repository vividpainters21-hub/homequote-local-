import { describe, expect, it } from "vitest";
import { evaluateEntry, evaluateExit, simulateEntryFill } from "@meme-jarvis/paper-trading";
import type { EntryContext, EntrySignal, ExitContext, OpenPositionState } from "@meme-jarvis/paper-trading";
import { DEFAULT_PAPER_ACCOUNT } from "@meme-jarvis/shared";

function goodSignal(overrides: Partial<EntrySignal> = {}): EntrySignal {
  return {
    tokenMint: "mintA",
    opportunityScore: 90,
    riskScore: 15,
    riskCriticalDisqualified: false,
    liquidityUsd: 100_000,
    strongTraderCount: 5,
    alreadyPumpedPct: 20,
    priceUsd: 0.001,
    ...overrides,
  };
}

function context(overrides: Partial<EntryContext> = {}): EntryContext {
  return {
    settings: DEFAULT_PAPER_ACCOUNT,
    currentBalanceUsd: 10_000,
    openPositionsCount: 0,
    realizedPnlTodayUsd: 0,
    ...overrides,
  };
}

describe("evaluateEntry", () => {
  it("enters when every rule passes", () => {
    const decision = evaluateEntry(goodSignal(), context());
    expect(decision.shouldEnter).toBe(true);
  });

  it("rejects a critically disqualified token regardless of its score", () => {
    const decision = evaluateEntry(goodSignal({ opportunityScore: 99, riskCriticalDisqualified: true }), context());
    expect(decision.shouldEnter).toBe(false);
    expect(decision.reason).toMatch(/disqualified/i);
  });

  it("rejects when below the minimum opportunity score", () => {
    const decision = evaluateEntry(goodSignal({ opportunityScore: 10 }), context());
    expect(decision.shouldEnter).toBe(false);
  });

  it("rejects when at max concurrent positions", () => {
    const decision = evaluateEntry(goodSignal(), context({ openPositionsCount: DEFAULT_PAPER_ACCOUNT.maxConcurrentPositions }));
    expect(decision.shouldEnter).toBe(false);
  });

  it("rejects when the daily loss limit has already been hit", () => {
    const decision = evaluateEntry(goodSignal(), context({ realizedPnlTodayUsd: -DEFAULT_PAPER_ACCOUNT.maxDailyLossUsd }));
    expect(decision.shouldEnter).toBe(false);
    expect(decision.reason).toMatch(/daily loss/i);
  });

  it("rejects when fewer strong traders entered than required", () => {
    const decision = evaluateEntry(goodSignal({ strongTraderCount: 0 }), context());
    expect(decision.shouldEnter).toBe(false);
  });
});

describe("simulateEntryFill", () => {
  it("applies fees and slippage against the raw market price", () => {
    const fill = simulateEntryFill(1000, 1, { feeBps: 100, maxSlippagePct: 5 });
    expect(fill.feesUsd).toBeCloseTo(10, 5);
    expect(fill.fillPriceUsd).toBeCloseTo(1.05, 5);
    expect(fill.tokensReceived).toBeCloseTo(990 / 1.05, 5);
  });
});

describe("evaluateExit", () => {
  function position(overrides: Partial<OpenPositionState> = {}): OpenPositionState {
    return {
      entryPriceUsd: 1,
      highWaterMarkUsd: 1,
      openedAtMs: Date.now() - 60_000,
      settings: DEFAULT_PAPER_ACCOUNT,
      ...overrides,
    };
  }
  function ctx(overrides: Partial<ExitContext> = {}): ExitContext {
    return { currentPriceUsd: 1, nowMs: Date.now(), ...overrides };
  }

  it("exits on stop loss", () => {
    const decision = evaluateExit(position(), ctx({ currentPriceUsd: 1 - DEFAULT_PAPER_ACCOUNT.stopLossPct / 100 - 0.01 }));
    expect(decision.shouldExit).toBe(true);
    expect(decision.reason).toBe("STOP_LOSS");
  });

  it("exits on the final take-profit target", () => {
    const decision = evaluateExit(position(), ctx({ currentPriceUsd: 1 + DEFAULT_PAPER_ACCOUNT.takeProfit3Pct / 100 + 0.01 }));
    expect(decision.shouldExit).toBe(true);
    expect(decision.reason).toBe("TAKE_PROFIT_3");
  });

  it("exits on liquidity collapse even while the trade is profitable", () => {
    const decision = evaluateExit(
      position(),
      ctx({ currentPriceUsd: 1.1, entryLiquidityUsd: 100_000, currentLiquidityUsd: 20_000 })
    );
    expect(decision.shouldExit).toBe(true);
    expect(decision.reason).toBe("LIQUIDITY_COLLAPSE");
  });

  it("exits when a smart-money exit is detected", () => {
    const decision = evaluateExit(position(), ctx({ currentPriceUsd: 1.05, smartWalletsStillHoldingRatioPct: 10 }));
    expect(decision.shouldExit).toBe(true);
    expect(decision.reason).toBe("SMART_MONEY_EXIT");
  });

  it("does not exit when price is flat and nothing else has triggered", () => {
    const decision = evaluateExit(position(), ctx({ currentPriceUsd: 1.01 }));
    expect(decision.shouldExit).toBe(false);
  });

  it("exits on the time-based rule once max hold time is exceeded", () => {
    const decision = evaluateExit(
      position({ openedAtMs: Date.now() - (DEFAULT_PAPER_ACCOUNT.maxHoldTimeSec + 60) * 1000 }),
      ctx({ currentPriceUsd: 1.02 })
    );
    expect(decision.shouldExit).toBe(true);
    expect(decision.reason).toBe("TIME_BASED");
  });
});
