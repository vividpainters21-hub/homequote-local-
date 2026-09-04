export * from "./dexscreener.js";
export * from "./birdeye.js";

import { getTokenSnapshot } from "./dexscreener.js";
import { getBirdeyeOverview, isBirdeyeConfigured } from "./birdeye.js";
import type { TokenMarketSnapshot } from "@meme-jarvis/shared";

/**
 * Merge DEX Screener (primary, no key needed) with Birdeye (optional,
 * fills 1m/15m volume + unique buyer gaps) into one snapshot.
 */
export async function getMergedTokenSnapshot(mintAddress: string): Promise<TokenMarketSnapshot | null> {
  const base = await getTokenSnapshot(mintAddress);
  if (!isBirdeyeConfigured()) return base;

  const extra = await getBirdeyeOverview(mintAddress);
  if (!extra) return base;
  if (!base) {
    return {
      tokenMint: mintAddress,
      priceUsd: extra.priceUsd ?? 0,
      liquidityUsd: extra.liquidityUsd ?? 0,
      ...extra,
    };
  }
  return {
    ...base,
    volume1mUsd: base.volume1mUsd ?? extra.volume1mUsd,
    volume15mUsd: base.volume15mUsd ?? extra.volume15mUsd,
    uniqueBuyers5m: base.uniqueBuyers5m ?? extra.uniqueBuyers5m,
  };
}
