import {
  DEFAULT_OPPORTUNITY_WEIGHTS,
  type OpportunityBreakdownItem,
  type OpportunityScoreResult,
  type OpportunityWeights,
  type TokenMarketSnapshot,
} from "@meme-jarvis/shared";

export interface OpportunityInput {
  market: TokenMarketSnapshot;
  smartWalletsBuying: number;
  smartWalletsSelling: number;
  avgTraderScoreOfBuyers: number; // 0-100
  volumePrev5mUsd?: number;
  uniqueBuyers5mPrev?: number;
  holderConcentrationPct?: number; // top10HolderPct
  alreadyPumpedPct?: number; // price change since token creation / first smart entry
  smartWalletsHoldingRatioPct?: number; // % of smart buyers still holding
  clusterScore?: number; // 0-100 from cluster-engine, 0/undefined if no cluster
  riskCriticalDisqualified: boolean;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Pure, explainable, config-driven opportunity scoring. Every category's
 * "quality" is a 0-1 ratio; awarded points = weight * quality. Nothing here
 * is hard-coded as a permanent constant beyond the default weights, which
 * are meant to be tuned via backtesting (see /paper-trading analytics).
 */
export function computeOpportunityScore(
  input: OpportunityInput,
  weights: OpportunityWeights = DEFAULT_OPPORTUNITY_WEIGHTS
): OpportunityScoreResult {
  const m = input.market;
  const breakdown: OpportunityBreakdownItem[] = [];
  const reasons: string[] = [];
  const warnings: string[] = [];

  // 1. Smart wallet accumulation
  {
    const buyerCountQuality = clamp01(input.smartWalletsBuying / 8);
    const scoreQuality = clamp01(input.avgTraderScoreOfBuyers / 100);
    let quality = 0.5 * buyerCountQuality + 0.5 * scoreQuality;
    if (input.smartWalletsSelling > input.smartWalletsBuying) quality *= 0.3;
    breakdown.push({
      category: "Smart wallet accumulation",
      weight: weights.smartWalletAccumulation,
      awarded: weights.smartWalletAccumulation * quality,
      reason: `${input.smartWalletsBuying} tracked smart wallet(s) buying (avg score ${input.avgTraderScoreOfBuyers.toFixed(0)}).`,
    });
    if (input.smartWalletsBuying < 3) {
      warnings.push("Fewer than 3 tracked smart wallets observed on this token — signal may be less reliable.");
    }
  }

  // 2. Volume acceleration
  {
    const current = m.volume5mUsd ?? 0;
    let quality: number;
    if (input.volumePrev5mUsd !== undefined && input.volumePrev5mUsd > 0) {
      quality = clamp01((current - input.volumePrev5mUsd) / input.volumePrev5mUsd / 3);
    } else {
      quality = current > 0 ? 0.5 : 0;
      warnings.push("No prior volume bucket to compare — acceleration estimate is approximate.");
    }
    breakdown.push({
      category: "Volume acceleration",
      weight: weights.volumeAcceleration,
      awarded: weights.volumeAcceleration * quality,
      reason: `5m volume $${Math.round(current).toLocaleString()}${input.volumePrev5mUsd ? ` vs $${Math.round(input.volumePrev5mUsd).toLocaleString()} prior` : ""}.`,
    });
  }

  // 3. Buy/sell pressure
  {
    const buys = m.buyCount5m ?? 0;
    const sells = m.sellCount5m ?? 0;
    const ratio = buys / Math.max(sells, 1);
    const quality = clamp01((ratio - 1) / 4);
    breakdown.push({
      category: "Buy/sell pressure",
      weight: weights.buySellPressure,
      awarded: weights.buySellPressure * quality,
      reason: `Buy/sell ratio ${ratio.toFixed(1)}:1 (${buys} buys / ${sells} sells, 5m).`,
    });
  }

  // 4. Unique buyer growth
  {
    const current = m.uniqueBuyers5m ?? 0;
    let quality: number;
    if (input.uniqueBuyers5mPrev !== undefined) {
      quality = clamp01((current - input.uniqueBuyers5mPrev) / Math.max(input.uniqueBuyers5mPrev, 1) / 2);
    } else {
      quality = clamp01(current / 20);
    }
    breakdown.push({
      category: "Unique buyer growth",
      weight: weights.uniqueBuyerGrowth,
      awarded: weights.uniqueBuyerGrowth * quality,
      reason: `${current} unique buyers in the last 5 minutes.`,
    });
  }

  // 5. Liquidity quality
  {
    const depthQuality = clamp01(m.liquidityUsd / 250_000);
    const stabilityQuality = m.liquidityChangePct !== undefined ? clamp01(1 + m.liquidityChangePct / 100) : 1;
    const quality = depthQuality * stabilityQuality;
    breakdown.push({
      category: "Liquidity quality",
      weight: weights.liquidityQuality,
      awarded: weights.liquidityQuality * quality,
      reason: `Liquidity $${Math.round(m.liquidityUsd).toLocaleString()}${m.liquidityChangePct !== undefined ? ` (${m.liquidityChangePct >= 0 ? "+" : ""}${m.liquidityChangePct.toFixed(0)}%)` : ""}.`,
    });
  }

  // 6. Holder distribution
  {
    const quality = input.holderConcentrationPct !== undefined ? clamp01(1 - input.holderConcentrationPct / 60) : 0.5;
    breakdown.push({
      category: "Holder distribution",
      weight: weights.holderDistribution,
      awarded: weights.holderDistribution * quality,
      reason:
        input.holderConcentrationPct !== undefined
          ? `Top 10 holders own ${input.holderConcentrationPct.toFixed(1)}% of supply.`
          : "Holder distribution data unavailable.",
    });
    if (input.holderConcentrationPct === undefined) warnings.push("Holder distribution data unavailable.");
  }

  // 7. Not overly extended
  {
    const quality = input.alreadyPumpedPct !== undefined ? clamp01(1 - input.alreadyPumpedPct / 500) : 1;
    breakdown.push({
      category: "Not overly extended",
      weight: weights.notOverExtended,
      awarded: weights.notOverExtended * quality,
      reason:
        input.alreadyPumpedPct !== undefined
          ? `Price is up ${input.alreadyPumpedPct.toFixed(0)}% since tracking began.`
          : "No prior price baseline recorded yet.",
    });
    if (input.alreadyPumpedPct !== undefined && input.alreadyPumpedPct > 300) {
      warnings.push(`Token has already pumped ${input.alreadyPumpedPct.toFixed(0)}% — chasing risk.`);
    }
  }

  // 8. Smart wallets continuing to hold
  {
    const quality = input.smartWalletsHoldingRatioPct !== undefined ? clamp01(input.smartWalletsHoldingRatioPct / 100) : 0.5;
    breakdown.push({
      category: "Smart wallets still holding",
      weight: weights.smartWalletsHolding,
      awarded: weights.smartWalletsHolding * quality,
      reason:
        input.smartWalletsHoldingRatioPct !== undefined
          ? `${input.smartWalletsHoldingRatioPct.toFixed(0)}% of tracked smart buyers have not exited.`
          : "No exit data yet.",
    });
  }

  // 9. Positive price momentum
  {
    const change = m.priceChange5mPct ?? 0;
    const quality = clamp01(0.5 + change / 40);
    breakdown.push({
      category: "Positive price momentum",
      weight: weights.positiveMomentum,
      awarded: weights.positiveMomentum * quality,
      reason: `Price change (5m): ${change >= 0 ? "+" : ""}${change.toFixed(1)}%.`,
    });
  }

  // 10. Cluster strength
  {
    const quality = clamp01((input.clusterScore ?? 0) / 100);
    breakdown.push({
      category: "Cluster strength",
      weight: weights.clusterStrength,
      awarded: weights.clusterStrength * quality,
      reason:
        input.clusterScore !== undefined
          ? `Smart-money cluster score ${input.clusterScore.toFixed(0)}/100.`
          : "No smart-money cluster detected.",
    });
  }

  const score = clamp01(breakdown.reduce((s, b) => s + b.awarded, 0) / 100) * 100;

  const sortedByStrength = [...breakdown].sort((a, b) => b.awarded / b.weight - a.awarded / a.weight);
  for (const item of sortedByStrength) {
    if (item.awarded / item.weight >= 0.65 && reasons.length < 5) {
      reasons.push(item.reason);
    }
  }

  let status: OpportunityScoreResult["status"];
  if (input.riskCriticalDisqualified) status = "DISQUALIFIED";
  else if (score >= 85) status = "HIGH_QUALITY_SETUP";
  else if (score >= 65) status = "WATCH";
  else status = "WEAK";

  return { score, breakdown, reasons, warnings, status };
}
