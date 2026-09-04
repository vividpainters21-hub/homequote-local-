import type { TokenMarketSnapshot, TokenSecurityInfo } from "@meme-jarvis/shared";

export interface RiskEngineInput extends TokenMarketSnapshot, TokenSecurityInfo {
  priceImpactPctForTypicalTrade?: number;
  alreadyPumpedPct?: number; // price change since token creation / first smart-money entry
  whaleDumpDetectedRecently?: boolean;
  smartWalletsExitingCount?: number;
  smartWalletsHoldingCount?: number;
}
