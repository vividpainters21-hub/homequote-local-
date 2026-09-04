import { describe, expect, it } from "vitest";
import { computeOpportunityScore, type OpportunityInput } from "@meme-jarvis/scoring-engine";
import { DEFAULT_OPPORTUNITY_WEIGHTS } from "@meme-jarvis/shared";

function strongInput(overrides: Partial<OpportunityInput> = {}): OpportunityInput {
  return {
    market: {
      tokenMint: "mintA",
      priceUsd: 0.001,
      liquidityUsd: 300_000,
      liquidityChangePct: 20,
      volume5mUsd: 80_000,
      buyCount5m: 50,
      sellCount5m: 5,
      uniqueBuyers5m: 40,
      priceChange5mPct: 30,
    },
    smartWalletsBuying: 8,
    smartWalletsSelling: 1,
    avgTraderScoreOfBuyers: 95,
    volumePrev5mUsd: 20_000,
    uniqueBuyers5mPrev: 15,
    holderConcentrationPct: 10,
    alreadyPumpedPct: 5,
    smartWalletsHoldingRatioPct: 95,
    clusterScore: 95,
    riskCriticalDisqualified: false,
    ...overrides,
  };
}

describe("computeOpportunityScore", () => {
  it("scores a strong, well-rounded setup as HIGH_QUALITY_SETUP", () => {
    const result = computeOpportunityScore(strongInput());
    expect(result.status).toBe("HIGH_QUALITY_SETUP");
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("always returns DISQUALIFIED when risk is critical, no matter how good the rest of the signal is", () => {
    const result = computeOpportunityScore(strongInput({ riskCriticalDisqualified: true }));
    expect(result.status).toBe("DISQUALIFIED");
  });

  it("scores a weak, quiet token low", () => {
    const result = computeOpportunityScore(
      strongInput({
        smartWalletsBuying: 0,
        smartWalletsSelling: 0,
        avgTraderScoreOfBuyers: 0,
        clusterScore: 0,
        market: { tokenMint: "mintA", priceUsd: 0.001, liquidityUsd: 5_000, buyCount5m: 1, sellCount5m: 5, uniqueBuyers5m: 1, priceChange5mPct: -20 },
      })
    );
    expect(result.score).toBeLessThan(40);
    expect(result.status).not.toBe("HIGH_QUALITY_SETUP");
  });

  it("every breakdown category's awarded points never exceeds its configured weight", () => {
    const result = computeOpportunityScore(strongInput());
    for (const item of result.breakdown) {
      expect(item.awarded).toBeLessThanOrEqual(item.weight + 1e-9);
      expect(item.awarded).toBeGreaterThanOrEqual(0);
    }
  });

  it("respects custom weights instead of the hard-coded defaults", () => {
    const customWeights = { ...DEFAULT_OPPORTUNITY_WEIGHTS, smartWalletAccumulation: 0, liquidityQuality: 40 };
    const result = computeOpportunityScore(strongInput(), customWeights);
    const smartWalletItem = result.breakdown.find((b) => b.category === "Smart wallet accumulation");
    expect(smartWalletItem?.weight).toBe(0);
    expect(smartWalletItem?.awarded).toBe(0);
  });
});
