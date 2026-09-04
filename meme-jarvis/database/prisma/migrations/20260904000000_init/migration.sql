-- CreateEnum
CREATE TYPE "TradeSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "TradeSource" AS ENUM ('FOMO', 'ONCHAIN', 'MANUAL');

-- CreateEnum
CREATE TYPE "AlertCategory" AS ENUM ('SMART_MONEY_CLUSTER', 'HIGH_SCORE', 'RAPID_SCORE_INCREASE', 'SMART_MONEY_EXIT', 'WHALE_DUMP', 'LIQUIDITY_WARNING', 'RUG_WARNING', 'PAPER_ENTRY', 'PAPER_EXIT');

-- CreateEnum
CREATE TYPE "PaperPositionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ExitReason" AS ENUM ('STOP_LOSS', 'TAKE_PROFIT_1', 'TAKE_PROFIT_2', 'TAKE_PROFIT_3', 'TRAILING_STOP', 'SMART_MONEY_EXIT', 'RISK_SCORE_SPIKE', 'LIQUIDITY_COLLAPSE', 'TIME_BASED', 'MANUAL');

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "fomoUsername" TEXT,
    "label" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "winningTrades" INTEGER NOT NULL DEFAULT 0,
    "losingTrades" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "realizedPnlUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unrealizedPnlUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgWinnerUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgLoserUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "medianReturnPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profitFactor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgHoldTimeSec" INTEGER NOT NULL DEFAULT 0,
    "medianHoldTimeSec" INTEGER NOT NULL DEFAULT 0,
    "maxDrawdownPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rugsPurchased" INTEGER NOT NULL DEFAULT 0,
    "collapseRatePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "consistencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "perf7dPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "perf30dPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "perfLifetimePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "traderScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sampleSizeOk" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletScoreHistory" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "traderScore" DOUBLE PRECISION NOT NULL,
    "winRate" DOUBLE PRECISION NOT NULL,
    "realizedPnlUsd" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletScoreHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL,
    "mintAddress" TEXT NOT NULL,
    "symbol" TEXT,
    "name" TEXT,
    "deployerAddress" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokenCreatedAt" TIMESTAMP(3),
    "mintAuthorityRevoked" BOOLEAN,
    "freezeAuthorityRevoked" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenSnapshot" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "liquidityUsd" DOUBLE PRECISION NOT NULL,
    "marketCapUsd" DOUBLE PRECISION,
    "fdvUsd" DOUBLE PRECISION,
    "volume1mUsd" DOUBLE PRECISION,
    "volume5mUsd" DOUBLE PRECISION,
    "volume15mUsd" DOUBLE PRECISION,
    "volume1hUsd" DOUBLE PRECISION,
    "buyCount5m" INTEGER,
    "sellCount5m" INTEGER,
    "uniqueBuyers5m" INTEGER,
    "uniqueSellers5m" INTEGER,
    "priceChange5mPct" DOUBLE PRECISION,
    "priceChange1hPct" DOUBLE PRECISION,
    "liquidityChangePct" DOUBLE PRECISION,
    "txVelocityPerMin" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'dexscreener',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenHolderSnapshot" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "top10HolderPct" DOUBLE PRECISION,
    "top20HolderPct" DOUBLE PRECISION,
    "holderCount" INTEGER,
    "suspiciousClusterFlag" BOOLEAN NOT NULL DEFAULT false,
    "holdersJson" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenHolderSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "side" "TradeSide" NOT NULL,
    "source" "TradeSource" NOT NULL DEFAULT 'FOMO',
    "amountTokens" DOUBLE PRECISION,
    "valueUsd" DOUBLE PRECISION,
    "priceUsd" DOUBLE PRECISION,
    "txSignature" TEXT,
    "traderPnlUsd" DOUBLE PRECISION,
    "traderWinRatePct" DOUBLE PRECISION,
    "positionJson" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FomoEvent" (
    "id" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processingError" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FomoEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cluster" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "windowSeconds" INTEGER NOT NULL,
    "memberCount" INTEGER NOT NULL,
    "avgTraderScore" DOUBLE PRECISION NOT NULL,
    "avgWinRatePct" DOUBLE PRECISION NOT NULL,
    "totalAmountUsd" DOUBLE PRECISION NOT NULL,
    "buyingAccelerationPerMin" DOUBLE PRECISION,
    "priceChangeSincePct" DOUBLE PRECISION,
    "stillHoldingCount" INTEGER NOT NULL DEFAULT 0,
    "exitingCount" INTEGER NOT NULL DEFAULT 0,
    "clusterScore" DOUBLE PRECISION NOT NULL,
    "firstEntryAt" TIMESTAMP(3) NOT NULL,
    "lastEntryAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClusterMember" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "tradeId" TEXT,
    "enteredAt" TIMESTAMP(3) NOT NULL,
    "exitedAt" TIMESTAMP(3),

    CONSTRAINT "ClusterMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "criticalDisqualified" BOOLEAN NOT NULL DEFAULT false,
    "flags" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityScore" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "breakdown" JSONB NOT NULL,
    "reasons" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weights" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoringConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "category" "AlertCategory" NOT NULL,
    "tokenId" TEXT,
    "clusterId" TEXT,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "telegramSent" BOOLEAN NOT NULL DEFAULT false,
    "telegramMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startingBalanceUsd" DOUBLE PRECISION NOT NULL,
    "currentBalanceUsd" DOUBLE PRECISION NOT NULL,
    "positionSizeUsd" DOUBLE PRECISION NOT NULL,
    "riskPerTradePct" DOUBLE PRECISION NOT NULL,
    "maxConcurrentPositions" INTEGER NOT NULL,
    "maxDailyLossUsd" DOUBLE PRECISION NOT NULL,
    "minOpportunityScore" DOUBLE PRECISION NOT NULL,
    "maxRiskScore" DOUBLE PRECISION NOT NULL,
    "maxSlippagePct" DOUBLE PRECISION NOT NULL,
    "feeBps" INTEGER NOT NULL,
    "minLiquidityUsd" DOUBLE PRECISION NOT NULL,
    "maxPumpBeforeEntryPct" DOUBLE PRECISION NOT NULL,
    "minStrongTraders" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaperAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperPosition" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "status" "PaperPositionStatus" NOT NULL DEFAULT 'OPEN',
    "entryPriceUsd" DOUBLE PRECISION NOT NULL,
    "sizeUsd" DOUBLE PRECISION NOT NULL,
    "tokensHeld" DOUBLE PRECISION NOT NULL,
    "feesUsd" DOUBLE PRECISION NOT NULL,
    "slippagePct" DOUBLE PRECISION NOT NULL,
    "stopLossPct" DOUBLE PRECISION NOT NULL,
    "takeProfit1Pct" DOUBLE PRECISION NOT NULL,
    "takeProfit2Pct" DOUBLE PRECISION NOT NULL,
    "takeProfit3Pct" DOUBLE PRECISION NOT NULL,
    "trailingStopPct" DOUBLE PRECISION NOT NULL,
    "highWaterMarkUsd" DOUBLE PRECISION NOT NULL,
    "entryReason" JSONB NOT NULL,
    "signalSnapshot" JSONB NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaperPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperTrade" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "entryPriceUsd" DOUBLE PRECISION NOT NULL,
    "exitPriceUsd" DOUBLE PRECISION NOT NULL,
    "sizeUsd" DOUBLE PRECISION NOT NULL,
    "feesUsd" DOUBLE PRECISION NOT NULL,
    "slippagePct" DOUBLE PRECISION NOT NULL,
    "pnlUsd" DOUBLE PRECISION NOT NULL,
    "returnPct" DOUBLE PRECISION NOT NULL,
    "maxFavorableExcursionPct" DOUBLE PRECISION NOT NULL,
    "maxAdverseExcursionPct" DOUBLE PRECISION NOT NULL,
    "entryReason" JSONB NOT NULL,
    "exitReason" "ExitReason" NOT NULL,
    "exitReasonDetail" TEXT,
    "signalSnapshotEntry" JSONB NOT NULL,
    "signalSnapshotExit" JSONB,
    "holdTimeSec" INTEGER NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaperTrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_address_key" ON "Wallet"("address");

-- CreateIndex
CREATE INDEX "Wallet_traderScore_idx" ON "Wallet"("traderScore");

-- CreateIndex
CREATE INDEX "Wallet_address_idx" ON "Wallet"("address");

-- CreateIndex
CREATE INDEX "WalletScoreHistory_walletId_recordedAt_idx" ON "WalletScoreHistory"("walletId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Token_mintAddress_key" ON "Token"("mintAddress");

-- CreateIndex
CREATE INDEX "Token_symbol_idx" ON "Token"("symbol");

-- CreateIndex
CREATE INDEX "TokenSnapshot_tokenId_recordedAt_idx" ON "TokenSnapshot"("tokenId", "recordedAt");

-- CreateIndex
CREATE INDEX "TokenHolderSnapshot_tokenId_recordedAt_idx" ON "TokenHolderSnapshot"("tokenId", "recordedAt");

-- CreateIndex
CREATE INDEX "Trade_tokenId_occurredAt_idx" ON "Trade"("tokenId", "occurredAt");

-- CreateIndex
CREATE INDEX "Trade_walletId_occurredAt_idx" ON "Trade"("walletId", "occurredAt");

-- CreateIndex
CREATE INDEX "Trade_occurredAt_idx" ON "Trade"("occurredAt");

-- CreateIndex
CREATE INDEX "FomoEvent_processed_receivedAt_idx" ON "FomoEvent"("processed", "receivedAt");

-- CreateIndex
CREATE INDEX "Cluster_tokenId_createdAt_idx" ON "Cluster"("tokenId", "createdAt");

-- CreateIndex
CREATE INDEX "Cluster_clusterScore_idx" ON "Cluster"("clusterScore");

-- CreateIndex
CREATE INDEX "ClusterMember_clusterId_idx" ON "ClusterMember"("clusterId");

-- CreateIndex
CREATE INDEX "RiskAssessment_tokenId_computedAt_idx" ON "RiskAssessment"("tokenId", "computedAt");

-- CreateIndex
CREATE INDEX "OpportunityScore_tokenId_computedAt_idx" ON "OpportunityScore"("tokenId", "computedAt");

-- CreateIndex
CREATE INDEX "OpportunityScore_score_idx" ON "OpportunityScore"("score");

-- CreateIndex
CREATE UNIQUE INDEX "ScoringConfig_name_key" ON "ScoringConfig"("name");

-- CreateIndex
CREATE INDEX "Alert_category_createdAt_idx" ON "Alert"("category", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaperAccount_name_key" ON "PaperAccount"("name");

-- CreateIndex
CREATE INDEX "PaperPosition_accountId_status_idx" ON "PaperPosition"("accountId", "status");

-- CreateIndex
CREATE INDEX "PaperTrade_accountId_closedAt_idx" ON "PaperTrade"("accountId", "closedAt");

-- CreateIndex
CREATE INDEX "PaperTrade_tokenId_idx" ON "PaperTrade"("tokenId");

-- AddForeignKey
ALTER TABLE "WalletScoreHistory" ADD CONSTRAINT "WalletScoreHistory_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenSnapshot" ADD CONSTRAINT "TokenSnapshot_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenHolderSnapshot" ADD CONSTRAINT "TokenHolderSnapshot_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cluster" ADD CONSTRAINT "Cluster_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClusterMember" ADD CONSTRAINT "ClusterMember_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClusterMember" ADD CONSTRAINT "ClusterMember_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityScore" ADD CONSTRAINT "OpportunityScore_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperPosition" ADD CONSTRAINT "PaperPosition_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaperAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperPosition" ADD CONSTRAINT "PaperPosition_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperTrade" ADD CONSTRAINT "PaperTrade_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaperAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperTrade" ADD CONSTRAINT "PaperTrade_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE CASCADE ON UPDATE CASCADE;

