import { describe, expect, it } from "vitest";
import { computeWalletStats, MIN_SAMPLE_SIZE } from "@meme-jarvis/wallet-intelligence";
import { buildRoundTrips } from "@meme-jarvis/wallet-intelligence";
import type { ClosedRoundTrip, TraderTrade } from "@meme-jarvis/shared";

function rt(overrides: Partial<ClosedRoundTrip> = {}): ClosedRoundTrip {
  return {
    walletAddress: "wallet1",
    tokenMint: "mintA",
    entryPriceUsd: 1,
    exitPriceUsd: 1.5,
    entryValueUsd: 100,
    exitValueUsd: 150,
    pnlUsd: 50,
    returnPct: 50,
    holdTimeSec: 600,
    enteredAt: new Date(Date.now() - 3600_000).toISOString(),
    exitedAt: new Date().toISOString(),
    wasRug: false,
    ...overrides,
  };
}

describe("computeWalletStats", () => {
  it("shrinks the score toward zero when the sample size is below the minimum", () => {
    const oneLuckyTrade = [rt({ pnlUsd: 1000, returnPct: 1000, entryValueUsd: 100, exitValueUsd: 1100 })];
    const stats = computeWalletStats({ walletAddress: "w1", roundTrips: oneLuckyTrade });
    expect(stats.sampleSizeOk).toBe(false);
    // A single 10x trade should NOT produce anywhere near a top score.
    expect(stats.traderScore).toBeLessThan(20);
  });

  it("does not shrink the score once the sample size requirement is met", () => {
    const trips = Array.from({ length: MIN_SAMPLE_SIZE + 5 }, (_, i) =>
      rt({ pnlUsd: 20, returnPct: 20, exitedAt: new Date(Date.now() - i * 60_000).toISOString() })
    );
    const stats = computeWalletStats({ walletAddress: "w2", roundTrips: trips });
    expect(stats.sampleSizeOk).toBe(true);
    expect(stats.winRate).toBe(100);
    expect(stats.traderScore).toBeGreaterThan(50);
  });

  it("penalizes wallets with a high rug-purchase rate", () => {
    const trips = Array.from({ length: MIN_SAMPLE_SIZE }, (_, i) =>
      rt({ pnlUsd: 10, returnPct: 10, wasRug: i < 10, exitedAt: new Date(Date.now() - i * 60_000).toISOString() })
    );
    const stats = computeWalletStats({ walletAddress: "w3", roundTrips: trips });
    expect(stats.collapseRatePct).toBeGreaterThan(0);
    expect(stats.rugsPurchased).toBe(10);
  });

  it("computes profit factor as gross profit over gross loss", () => {
    const trips = [rt({ pnlUsd: 100 }), rt({ pnlUsd: -50 })];
    const stats = computeWalletStats({ walletAddress: "w4", roundTrips: trips });
    expect(stats.profitFactor).toBeCloseTo(2, 5);
  });
});

describe("buildRoundTrips", () => {
  it("matches a sell against prior buys FIFO and computes pnl", () => {
    const trades: TraderTrade[] = [
      {
        id: "1",
        walletAddress: "w1",
        tokenMint: "mintA",
        side: "BUY",
        source: "FOMO",
        amountTokens: 100,
        valueUsd: 100,
        occurredAt: new Date(Date.now() - 120_000).toISOString(),
      },
      {
        id: "2",
        walletAddress: "w1",
        tokenMint: "mintA",
        side: "SELL",
        source: "FOMO",
        amountTokens: 100,
        valueUsd: 150,
        occurredAt: new Date().toISOString(),
      },
    ];
    const trips = buildRoundTrips(trades);
    expect(trips).toHaveLength(1);
    expect(trips[0].pnlUsd).toBeCloseTo(50, 5);
    expect(trips[0].returnPct).toBeCloseTo(50, 5);
  });

  it("marks a round trip as a rug when the isRug callback says so", () => {
    const trades: TraderTrade[] = [
      { id: "1", walletAddress: "w1", tokenMint: "mintX", side: "BUY", source: "FOMO", amountTokens: 10, valueUsd: 10, occurredAt: new Date(Date.now() - 1000).toISOString() },
      { id: "2", walletAddress: "w1", tokenMint: "mintX", side: "SELL", source: "FOMO", amountTokens: 10, valueUsd: 1, occurredAt: new Date().toISOString() },
    ];
    const trips = buildRoundTrips(trades, (mint) => mint === "mintX");
    expect(trips[0].wasRug).toBe(true);
  });
});
