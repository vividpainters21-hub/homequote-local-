import type { RiskAssessmentResult, RiskFlag } from "@meme-jarvis/shared";
import type { RiskEngineInput } from "./types.js";

interface FlagContribution {
  flag: RiskFlag;
  contribution: number;
}

function check(input: RiskEngineInput): FlagContribution[] {
  const out: FlagContribution[] = [];

  // --- Liquidity ---
  if (input.liquidityUsd < 5_000) {
    out.push({
      contribution: 40,
      flag: { code: "LIQUIDITY_CRITICAL", severity: "critical", message: `Liquidity extremely low ($${Math.round(input.liquidityUsd).toLocaleString()}) — high rug/slippage risk.` },
    });
  } else if (input.liquidityUsd < 15_000) {
    out.push({
      contribution: 15,
      flag: { code: "LIQUIDITY_LOW", severity: "warning", message: `Liquidity is thin ($${Math.round(input.liquidityUsd).toLocaleString()}).` },
    });
  }

  // --- Holder concentration ---
  if (input.top10HolderPct !== undefined) {
    if (input.top10HolderPct > 60) {
      out.push({
        contribution: 35,
        flag: { code: "HOLDER_CONCENTRATION_CRITICAL", severity: "critical", message: `Top 10 holders own ${input.top10HolderPct.toFixed(1)}% of supply.` },
      });
    } else if (input.top10HolderPct > 35) {
      out.push({
        contribution: 15,
        flag: { code: "HOLDER_CONCENTRATION_WARNING", severity: "warning", message: `Top 10 holders own ${input.top10HolderPct.toFixed(1)}% of supply.` },
      });
    }
  }

  // --- Mint / freeze authority ---
  if (input.mintAuthorityRevoked === false) {
    out.push({
      contribution: 30,
      flag: { code: "MINT_AUTHORITY_ACTIVE", severity: "critical", message: "Mint authority is still active — supply can be inflated at will." },
    });
  }
  if (input.freezeAuthorityRevoked === false) {
    out.push({
      contribution: 30,
      flag: { code: "FREEZE_AUTHORITY_ACTIVE", severity: "critical", message: "Freeze authority is still active — holders can be blocked from selling." },
    });
  }

  // --- Sellability ---
  if (input.sellTestPassed === false) {
    out.push({
      contribution: 40,
      flag: { code: "NO_SELL_ROUTE", severity: "critical", message: "No sell route found for this token — likely honeypot." },
    });
  }

  // --- Liquidity stability ---
  if (input.liquidityRemovedRecently) {
    out.push({
      contribution: 40,
      flag: { code: "LIQUIDITY_REMOVED", severity: "critical", message: "Liquidity was recently pulled from the pool." },
    });
  }
  if (input.liquidityChangePct5m !== undefined) {
    if (input.liquidityChangePct5m <= -50) {
      out.push({
        contribution: 30,
        flag: { code: "LIQUIDITY_COLLAPSING", severity: "critical", message: `Liquidity fell ${input.liquidityChangePct5m.toFixed(0)}% in 5 minutes.` },
      });
    } else if (input.liquidityChangePct5m <= -20) {
      out.push({
        contribution: 12,
        flag: { code: "LIQUIDITY_FALLING", severity: "warning", message: `Liquidity fell ${input.liquidityChangePct5m.toFixed(0)}% in 5 minutes.` },
      });
    }
  }

  // --- Related wallets / suspicious behavior ---
  if (input.deployerRelatedWallets && input.deployerRelatedWallets.length > 0) {
    out.push({
      contribution: 10,
      flag: { code: "DEPLOYER_RELATED_WALLETS", severity: "warning", message: `${input.deployerRelatedWallets.length} deployer-linked wallet(s) detected among holders.` },
    });
  }
  if (input.suspiciousTransactionPattern) {
    out.push({
      contribution: 15,
      flag: { code: "SUSPICIOUS_TX_PATTERN", severity: "warning", message: "Suspicious transaction pattern detected (e.g. wash trading, bot loops)." },
    });
  }

  // --- Slippage ---
  if (input.priceImpactPctForTypicalTrade !== undefined) {
    if (input.priceImpactPctForTypicalTrade > 30) {
      out.push({
        contribution: 25,
        flag: { code: "EXTREME_SLIPPAGE", severity: "critical", message: `Estimated slippage >${input.priceImpactPctForTypicalTrade.toFixed(0)}% on a typical trade.` },
      });
    } else if (input.priceImpactPctForTypicalTrade > 15) {
      out.push({
        contribution: 12,
        flag: { code: "HIGH_SLIPPAGE", severity: "warning", message: `Estimated slippage ~${input.priceImpactPctForTypicalTrade.toFixed(0)}% on a typical trade.` },
      });
    }
  }

  // --- Token age ---
  if (input.tokenAgeSec !== undefined && input.tokenAgeSec < 300) {
    out.push({
      contribution: 10,
      flag: { code: "TOKEN_TOO_NEW", severity: "warning", message: "Token is less than 5 minutes old — insufficient history." },
    });
  }

  // --- Already extended ---
  if (input.alreadyPumpedPct !== undefined && input.alreadyPumpedPct > 500) {
    out.push({
      contribution: 10,
      flag: { code: "ALREADY_PUMPED", severity: "warning", message: `Token is already up ${input.alreadyPumpedPct.toFixed(0)}% — chasing risk.` },
    });
  }

  // --- Whale / smart-money exit behavior ---
  if (input.whaleDumpDetectedRecently) {
    out.push({
      contribution: 30,
      flag: { code: "WHALE_DUMP", severity: "critical", message: "A whale wallet dumped a large position recently." },
    });
  }
  if (
    input.smartWalletsExitingCount !== undefined &&
    input.smartWalletsHoldingCount !== undefined &&
    input.smartWalletsExitingCount >= 2 &&
    input.smartWalletsExitingCount > input.smartWalletsHoldingCount
  ) {
    out.push({
      contribution: 15,
      flag: { code: "SMART_MONEY_EXITING", severity: "warning", message: `${input.smartWalletsExitingCount} tracked smart wallet(s) have already exited.` },
    });
  }

  return out;
}

export function assessRisk(input: RiskEngineInput): RiskAssessmentResult {
  const contributions = check(input);
  const rawScore = contributions.reduce((s, c) => s + c.contribution, 0);
  const hasCritical = contributions.some((c) => c.flag.severity === "critical");
  const riskScore = Math.min(100, hasCritical ? Math.max(rawScore, 80) : rawScore);

  return {
    riskScore,
    criticalDisqualified: hasCritical,
    flags: contributions.map((c) => c.flag),
  };
}
