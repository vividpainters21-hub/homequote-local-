import type { ClosedRoundTrip, TraderTrade } from "@meme-jarvis/shared";

interface BuyLot {
  remainingTokens: number;
  priceUsd: number;
  valueUsd: number;
  occurredAt: string;
}

/**
 * Reconstructs closed round trips (buy -> sell) per wallet+token using FIFO
 * lot matching. Only closed portions produce a round trip; leftover open
 * buys are ignored here (unrealized PnL is handled separately from live
 * mark-to-market prices, not from trade history alone).
 */
export function buildRoundTrips(
  trades: TraderTrade[],
  isRug: (tokenMint: string) => boolean = () => false
): ClosedRoundTrip[] {
  const byGroup = new Map<string, TraderTrade[]>();
  for (const t of trades) {
    const key = `${t.walletAddress}::${t.tokenMint}`;
    const arr = byGroup.get(key) ?? [];
    arr.push(t);
    byGroup.set(key, arr);
  }

  const roundTrips: ClosedRoundTrip[] = [];

  for (const [key, groupTrades] of byGroup) {
    const [walletAddress, tokenMint] = key.split("::");
    const sorted = [...groupTrades].sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    );

    const lots: BuyLot[] = [];

    for (const trade of sorted) {
      if (trade.side === "BUY") {
        const amount = trade.amountTokens ?? 0;
        const value = trade.valueUsd ?? (trade.priceUsd ?? 0) * amount;
        if (amount <= 0) continue;
        lots.push({ remainingTokens: amount, priceUsd: value / amount, valueUsd: value, occurredAt: trade.occurredAt });
        continue;
      }

      // SELL: consume FIFO lots
      let sellAmount = trade.amountTokens ?? 0;
      const sellValueTotal = trade.valueUsd ?? (trade.priceUsd ?? 0) * sellAmount;
      if (sellAmount <= 0 || lots.length === 0) continue;
      const sellPrice = sellValueTotal / sellAmount;

      let weightedEntryTimeMs = 0;
      let matchedTokens = 0;
      let matchedCostUsd = 0;

      while (sellAmount > 1e-9 && lots.length > 0) {
        const lot = lots[0];
        const take = Math.min(lot.remainingTokens, sellAmount);
        const costOfTake = take * lot.priceUsd;

        matchedTokens += take;
        matchedCostUsd += costOfTake;
        weightedEntryTimeMs += new Date(lot.occurredAt).getTime() * take;

        lot.remainingTokens -= take;
        sellAmount -= take;
        if (lot.remainingTokens <= 1e-9) lots.shift();
      }

      if (matchedTokens <= 0) continue;

      const matchedSellValue = matchedTokens * sellPrice;
      const pnlUsd = matchedSellValue - matchedCostUsd;
      const returnPct = matchedCostUsd > 0 ? (pnlUsd / matchedCostUsd) * 100 : 0;
      const avgEntryTimeMs = weightedEntryTimeMs / matchedTokens;
      const exitTimeMs = new Date(trade.occurredAt).getTime();
      const holdTimeSec = Math.max(0, Math.round((exitTimeMs - avgEntryTimeMs) / 1000));

      roundTrips.push({
        walletAddress,
        tokenMint,
        entryPriceUsd: matchedCostUsd / matchedTokens,
        exitPriceUsd: sellPrice,
        entryValueUsd: matchedCostUsd,
        exitValueUsd: matchedSellValue,
        pnlUsd,
        returnPct,
        holdTimeSec,
        enteredAt: new Date(avgEntryTimeMs).toISOString(),
        exitedAt: trade.occurredAt,
        wasRug: isRug(tokenMint),
      });
    }
  }

  return roundTrips;
}
