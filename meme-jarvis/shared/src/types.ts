/**
 * Domain types shared across engines. These are intentionally decoupled from
 * the Prisma-generated types so that scoring/risk/cluster/paper-trading logic
 * is pure, unit-testable, and doesn't require a live database in tests.
 */

export type TradeSide = "BUY" | "SELL";
export type TradeSource = "FOMO" | "ONCHAIN" | "MANUAL";

export interface TraderTrade {
  id: string;
  walletAddress: string;
  tokenMint: string;
  side: TradeSide;
  source: TradeSource;
  amountTokens?: number;
  valueUsd?: number;
  priceUsd?: number;
  txSignature?: string;
  occurredAt: string; // ISO timestamp
}

/** A closed round-trip (buy -> sell) used for win/loss statistics. */
export interface ClosedRoundTrip {
  walletAddress: string;
  tokenMint: string;
  entryPriceUsd: number;
  exitPriceUsd: number;
  entryValueUsd: number;
  exitValueUsd: number;
  pnlUsd: number;
  returnPct: number;
  holdTimeSec: number;
  enteredAt: string;
  exitedAt: string;
  wasRug: boolean;
}

export interface WalletStatsInput {
  walletAddress: string;
  roundTrips: ClosedRoundTrip[];
  openPositionsUnrealizedPnlUsd?: number;
  now?: Date;
}

export interface WalletStats {
  walletAddress: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  avgWinnerUsd: number;
  avgLoserUsd: number;
  medianReturnPct: number;
  profitFactor: number;
  avgHoldTimeSec: number;
  medianHoldTimeSec: number;
  maxDrawdownPct: number;
  rugsPurchased: number;
  collapseRatePct: number;
  consistencyScore: number;
  perf7dPct: number;
  perf30dPct: number;
  perfLifetimePct: number;
  traderScore: number;
  sampleSizeOk: boolean;
}

export interface TokenMarketSnapshot {
  tokenMint: string;
  symbol?: string;
  priceUsd: number;
  liquidityUsd: number;
  marketCapUsd?: number;
  fdvUsd?: number;
  tokenAgeSec?: number;
  volume1mUsd?: number;
  volume5mUsd?: number;
  volume15mUsd?: number;
  volume1hUsd?: number;
  buyCount5m?: number;
  sellCount5m?: number;
  uniqueBuyers5m?: number;
  uniqueSellers5m?: number;
  priceChange5mPct?: number;
  priceChange1hPct?: number;
  liquidityChangePct?: number;
  txVelocityPerMin?: number;
}

export interface TokenHolderInfo {
  address: string;
  pctOfSupply: number;
}

export interface TokenSecurityInfo {
  mintAuthorityRevoked?: boolean;
  freezeAuthorityRevoked?: boolean;
  top10HolderPct?: number;
  holderCount?: number;
  deployerAddress?: string;
  deployerRelatedWallets?: string[];
  liquidityRemovedRecently?: boolean;
  liquidityChangePct5m?: number;
  sellTestPassed?: boolean;
  suspiciousTransactionPattern?: boolean;
}

export interface TraderEntry {
  walletAddress: string;
  traderScore: number;
  winRate: number;
  amountUsd: number;
  side: TradeSide;
  occurredAt: string;
}

export interface ClusterCandidate {
  tokenMint: string;
  entries: TraderEntry[]; // strong-trader entries only, chronological
  priceAtFirstEntryUsd?: number;
  priceNowUsd?: number;
}

export interface ClusterResult {
  tokenMint: string;
  windowSeconds: number;
  memberCount: number;
  avgTraderScore: number;
  avgWinRatePct: number;
  totalAmountUsd: number;
  buyingAccelerationPerMin: number;
  stillHoldingCount: number;
  exitingCount: number;
  priceChangeSincePct: number | null;
  clusterScore: number;
  firstEntryAt: string;
  lastEntryAt: string;
  members: string[]; // wallet addresses
}

export interface RiskAssessmentResult {
  riskScore: number; // 0 (low) - 100 (extreme)
  criticalDisqualified: boolean;
  flags: RiskFlag[];
}

export interface RiskFlag {
  code: string;
  severity: "info" | "warning" | "critical";
  message: string;
}

export interface OpportunityBreakdownItem {
  category: string;
  weight: number;
  awarded: number;
  reason: string;
}

export interface OpportunityScoreResult {
  score: number;
  breakdown: OpportunityBreakdownItem[];
  reasons: string[];
  warnings: string[];
  status: "HIGH_QUALITY_SETUP" | "WATCH" | "WEAK" | "DISQUALIFIED";
}

export interface OpportunityWeights {
  smartWalletAccumulation: number;
  volumeAcceleration: number;
  buySellPressure: number;
  uniqueBuyerGrowth: number;
  liquidityQuality: number;
  holderDistribution: number;
  notOverExtended: number;
  smartWalletsHolding: number;
  positiveMomentum: number;
  clusterStrength: number;
}

export const DEFAULT_OPPORTUNITY_WEIGHTS: OpportunityWeights = {
  smartWalletAccumulation: 20,
  volumeAcceleration: 15,
  buySellPressure: 10,
  uniqueBuyerGrowth: 10,
  liquidityQuality: 15,
  holderDistribution: 10,
  notOverExtended: 5,
  smartWalletsHolding: 5,
  positiveMomentum: 5,
  clusterStrength: 5,
};

export interface PaperAccountSettings {
  name: string;
  startingBalanceUsd: number;
  positionSizeUsd: number;
  riskPerTradePct: number;
  maxConcurrentPositions: number;
  maxDailyLossUsd: number;
  minOpportunityScore: number;
  maxRiskScore: number;
  maxSlippagePct: number;
  feeBps: number;
  minLiquidityUsd: number;
  maxPumpBeforeEntryPct: number;
  minStrongTraders: number;
  stopLossPct: number;
  takeProfit1Pct: number;
  takeProfit2Pct: number;
  takeProfit3Pct: number;
  trailingStopPct: number;
  maxHoldTimeSec: number;
}

export const DEFAULT_PAPER_ACCOUNT: PaperAccountSettings = {
  name: "default",
  startingBalanceUsd: 10_000,
  positionSizeUsd: 250,
  riskPerTradePct: 2.5,
  maxConcurrentPositions: 6,
  maxDailyLossUsd: 500,
  minOpportunityScore: 80,
  maxRiskScore: 30,
  maxSlippagePct: 3,
  feeBps: 100,
  minLiquidityUsd: 15_000,
  maxPumpBeforeEntryPct: 300,
  minStrongTraders: 3,
  stopLossPct: 20,
  takeProfit1Pct: 25,
  takeProfit2Pct: 60,
  takeProfit3Pct: 150,
  trailingStopPct: 15,
  maxHoldTimeSec: 6 * 60 * 60,
};

export type AlertCategory =
  | "SMART_MONEY_CLUSTER"
  | "HIGH_SCORE"
  | "RAPID_SCORE_INCREASE"
  | "SMART_MONEY_EXIT"
  | "WHALE_DUMP"
  | "LIQUIDITY_WARNING"
  | "RUG_WARNING"
  | "PAPER_ENTRY"
  | "PAPER_EXIT";
