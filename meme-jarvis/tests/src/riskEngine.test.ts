import { describe, expect, it } from "vitest";
import { assessRisk } from "@meme-jarvis/risk-engine";
import type { RiskEngineInput } from "@meme-jarvis/risk-engine";

function baseInput(overrides: Partial<RiskEngineInput> = {}): RiskEngineInput {
  return {
    tokenMint: "mintA",
    priceUsd: 0.001,
    liquidityUsd: 100_000,
    mintAuthorityRevoked: true,
    freezeAuthorityRevoked: true,
    sellTestPassed: true,
    top10HolderPct: 20,
    ...overrides,
  };
}

describe("assessRisk", () => {
  it("gives a healthy token a low, non-disqualifying risk score", () => {
    const result = assessRisk(baseInput());
    expect(result.criticalDisqualified).toBe(false);
    expect(result.riskScore).toBeLessThan(20);
  });

  it("automatically disqualifies a token with an active mint authority regardless of everything else looking fine", () => {
    const result = assessRisk(baseInput({ mintAuthorityRevoked: false }));
    expect(result.criticalDisqualified).toBe(true);
    expect(result.riskScore).toBeGreaterThanOrEqual(80);
    expect(result.flags.some((f) => f.code === "MINT_AUTHORITY_ACTIVE")).toBe(true);
  });

  it("disqualifies a token with no sell route (honeypot)", () => {
    const result = assessRisk(baseInput({ sellTestPassed: false }));
    expect(result.criticalDisqualified).toBe(true);
    expect(result.flags.some((f) => f.code === "NO_SELL_ROUTE")).toBe(true);
  });

  it("flags but does not necessarily disqualify thin liquidity alone", () => {
    const result = assessRisk(baseInput({ liquidityUsd: 10_000 }));
    expect(result.flags.some((f) => f.code === "LIQUIDITY_LOW")).toBe(true);
    expect(result.criticalDisqualified).toBe(false);
  });

  it("caps the risk score at 100 even with many stacked critical flags", () => {
    const result = assessRisk(
      baseInput({
        mintAuthorityRevoked: false,
        freezeAuthorityRevoked: false,
        sellTestPassed: false,
        liquidityUsd: 1000,
        top10HolderPct: 90,
        liquidityRemovedRecently: true,
        whaleDumpDetectedRecently: true,
      })
    );
    expect(result.riskScore).toBeLessThanOrEqual(100);
    expect(result.criticalDisqualified).toBe(true);
  });
});
