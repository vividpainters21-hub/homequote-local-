import type { PaperAccountSettings } from "@meme-jarvis/shared";

export interface EntrySignal {
  tokenMint: string;
  opportunityScore: number;
  riskScore: number;
  riskCriticalDisqualified: boolean;
  liquidityUsd: number;
  strongTraderCount: number;
  alreadyPumpedPct: number;
  priceUsd: number;
}

export interface EntryContext {
  settings: PaperAccountSettings;
  currentBalanceUsd: number;
  openPositionsCount: number;
  realizedPnlTodayUsd: number;
}

export interface EntryDecision {
  shouldEnter: boolean;
  reason: string;
}

export interface ExitContext {
  currentPriceUsd: number;
  currentLiquidityUsd?: number;
  entryLiquidityUsd?: number;
  currentRiskScore?: number;
  smartWalletsStillHoldingRatioPct?: number;
  nowMs: number;
}

export interface OpenPositionState {
  entryPriceUsd: number;
  highWaterMarkUsd: number;
  openedAtMs: number;
  settings: PaperAccountSettings;
}

export type ExitReasonCode =
  | "STOP_LOSS"
  | "TAKE_PROFIT_1"
  | "TAKE_PROFIT_2"
  | "TAKE_PROFIT_3"
  | "TRAILING_STOP"
  | "SMART_MONEY_EXIT"
  | "RISK_SCORE_SPIKE"
  | "LIQUIDITY_COLLAPSE"
  | "TIME_BASED"
  | "MANUAL";

export interface ExitDecision {
  shouldExit: boolean;
  reason?: ExitReasonCode;
  detail?: string;
  newHighWaterMarkUsd: number;
}
