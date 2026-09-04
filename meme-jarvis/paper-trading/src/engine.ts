import type { EntryContext, EntryDecision, EntrySignal, ExitContext, ExitDecision, OpenPositionState } from "./types.js";

/**
 * Phase 10 entry rules, evaluated in order — the first failing rule is the
 * reported reason so operators can see exactly why a strong-looking token
 * was skipped.
 */
export function evaluateEntry(signal: EntrySignal, context: EntryContext): EntryDecision {
  const { settings } = context;

  if (signal.riskCriticalDisqualified) {
    return { shouldEnter: false, reason: "Token has a critical risk flag — automatically disqualified." };
  }
  if (signal.opportunityScore < settings.minOpportunityScore) {
    return {
      shouldEnter: false,
      reason: `Opportunity score ${signal.opportunityScore.toFixed(0)} is below minimum ${settings.minOpportunityScore}.`,
    };
  }
  if (signal.riskScore > settings.maxRiskScore) {
    return {
      shouldEnter: false,
      reason: `Risk score ${signal.riskScore.toFixed(0)} exceeds maximum ${settings.maxRiskScore}.`,
    };
  }
  if (signal.liquidityUsd < settings.minLiquidityUsd) {
    return {
      shouldEnter: false,
      reason: `Liquidity $${Math.round(signal.liquidityUsd).toLocaleString()} is below minimum $${settings.minLiquidityUsd.toLocaleString()}.`,
    };
  }
  if (signal.strongTraderCount < settings.minStrongTraders) {
    return {
      shouldEnter: false,
      reason: `Only ${signal.strongTraderCount} strong trader(s) entered; minimum is ${settings.minStrongTraders}.`,
    };
  }
  if (signal.alreadyPumpedPct > settings.maxPumpBeforeEntryPct) {
    return {
      shouldEnter: false,
      reason: `Token is already up ${signal.alreadyPumpedPct.toFixed(0)}%, above the ${settings.maxPumpBeforeEntryPct}% chase limit.`,
    };
  }
  if (context.openPositionsCount >= settings.maxConcurrentPositions) {
    return {
      shouldEnter: false,
      reason: `Already at max concurrent positions (${settings.maxConcurrentPositions}).`,
    };
  }
  if (context.realizedPnlTodayUsd <= -Math.abs(settings.maxDailyLossUsd)) {
    return {
      shouldEnter: false,
      reason: `Daily loss limit of $${settings.maxDailyLossUsd.toLocaleString()} already reached — trading paused for the day.`,
    };
  }
  if (context.currentBalanceUsd < settings.positionSizeUsd) {
    return { shouldEnter: false, reason: "Insufficient paper balance for the configured position size." };
  }

  return {
    shouldEnter: true,
    reason: `Passed all entry rules: score ${signal.opportunityScore.toFixed(0)}, risk ${signal.riskScore.toFixed(0)}, ${signal.strongTraderCount} strong traders.`,
  };
}

export interface SimulatedFill {
  fillPriceUsd: number;
  feesUsd: number;
  tokensReceived: number;
}

/** Applies configured fee (bps) and slippage assumptions to a simulated buy. */
export function simulateEntryFill(sizeUsd: number, marketPriceUsd: number, settings: { feeBps: number; maxSlippagePct: number }): SimulatedFill {
  const feesUsd = (sizeUsd * settings.feeBps) / 10_000;
  const netUsd = sizeUsd - feesUsd;
  // Assume we pay the full configured max-slippage assumption on entry (conservative).
  const fillPriceUsd = marketPriceUsd * (1 + settings.maxSlippagePct / 100);
  const tokensReceived = netUsd / fillPriceUsd;
  return { fillPriceUsd, feesUsd, tokensReceived };
}

export function simulateExitFill(tokensHeld: number, marketPriceUsd: number, settings: { feeBps: number; maxSlippagePct: number }): SimulatedFill {
  const fillPriceUsd = marketPriceUsd * (1 - settings.maxSlippagePct / 100);
  const grossUsd = tokensHeld * fillPriceUsd;
  const feesUsd = (grossUsd * settings.feeBps) / 10_000;
  return { fillPriceUsd, feesUsd, tokensReceived: grossUsd - feesUsd };
}

/**
 * Phase 10 exit rules. Take-profit tiers 1 and 2 arm and then tighten a
 * trailing stop (a "ratchet") rather than force a full close — this keeps
 * the single-lot position model simple while still capturing the intent of
 * locking in gains progressively. Take-profit 3 and every other rule below
 * always fully close the position. Rules are checked in a fixed priority
 * order so capital-protection rules win over profit-taking rules.
 */
export function evaluateExit(position: OpenPositionState, ctx: ExitContext): ExitDecision {
  const { settings } = position;
  const newHighWaterMarkUsd = Math.max(position.highWaterMarkUsd, ctx.currentPriceUsd);
  const pnlPct = ((ctx.currentPriceUsd - position.entryPriceUsd) / position.entryPriceUsd) * 100;

  if (pnlPct <= -settings.stopLossPct) {
    return { shouldExit: true, reason: "STOP_LOSS", detail: `Price fell ${pnlPct.toFixed(1)}%.`, newHighWaterMarkUsd };
  }

  if (
    ctx.currentLiquidityUsd !== undefined &&
    ctx.entryLiquidityUsd !== undefined &&
    ctx.entryLiquidityUsd > 0 &&
    ctx.currentLiquidityUsd / ctx.entryLiquidityUsd < 0.5
  ) {
    return {
      shouldExit: true,
      reason: "LIQUIDITY_COLLAPSE",
      detail: `Liquidity fell to ${((ctx.currentLiquidityUsd / ctx.entryLiquidityUsd) * 100).toFixed(0)}% of entry level.`,
      newHighWaterMarkUsd,
    };
  }

  if (ctx.currentRiskScore !== undefined && ctx.currentRiskScore >= 70) {
    return {
      shouldExit: true,
      reason: "RISK_SCORE_SPIKE",
      detail: `Risk score spiked to ${ctx.currentRiskScore.toFixed(0)}.`,
      newHighWaterMarkUsd,
    };
  }

  if (ctx.smartWalletsStillHoldingRatioPct !== undefined && ctx.smartWalletsStillHoldingRatioPct < 40) {
    return {
      shouldExit: true,
      reason: "SMART_MONEY_EXIT",
      detail: `Only ${ctx.smartWalletsStillHoldingRatioPct.toFixed(0)}% of tracked smart wallets still holding.`,
      newHighWaterMarkUsd,
    };
  }

  if (pnlPct >= settings.takeProfit3Pct) {
    return { shouldExit: true, reason: "TAKE_PROFIT_3", detail: `Reached final target of +${settings.takeProfit3Pct}%.`, newHighWaterMarkUsd };
  }

  const gainFromHighPct = ((position.entryPriceUsd - newHighWaterMarkUsd) / position.entryPriceUsd) * -100; // high-water gain
  const armed = gainFromHighPct >= settings.takeProfit1Pct;
  if (armed) {
    const tightened = gainFromHighPct >= settings.takeProfit2Pct;
    const effectiveTrailingPct = tightened ? settings.trailingStopPct / 2 : settings.trailingStopPct;
    const trailingStopPrice = newHighWaterMarkUsd * (1 - effectiveTrailingPct / 100);
    if (ctx.currentPriceUsd <= trailingStopPrice) {
      return {
        shouldExit: true,
        reason: "TRAILING_STOP",
        detail: `Trailing stop hit ${effectiveTrailingPct.toFixed(1)}% below high of $${newHighWaterMarkUsd.toFixed(8)}.`,
        newHighWaterMarkUsd,
      };
    }
  }

  if (ctx.nowMs - position.openedAtMs >= settings.maxHoldTimeSec * 1000) {
    return { shouldExit: true, reason: "TIME_BASED", detail: "Maximum hold time reached.", newHighWaterMarkUsd };
  }

  return { shouldExit: false, newHighWaterMarkUsd };
}
