import type { TokenMarketSnapshot } from "@meme-jarvis/shared";

/**
 * DEX Screener public API client.
 * Official docs: https://docs.dexscreener.com/api/reference
 * No API key required. Rate limits (per docs, subject to change):
 *  - /latest/dex/tokens/:addresses and /latest/dex/pairs/:chain/:pair -> 300 req/min
 *  - /latest/dex/search -> 300 req/min
 *  - /token-profiles/latest/v1, /token-boosts/* -> 60 req/min
 */

const BASE_URL = "https://api.dexscreener.com";

export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  priceNative?: string;
  txns?: Record<string, { buys: number; sells: number }>;
  volume?: Record<string, number>;
  priceChange?: Record<string, number>;
  liquidity?: { usd?: number; base?: number; quote?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
}

interface DexScreenerTokensResponse {
  schemaVersion?: string;
  pairs: DexScreenerPair[] | null;
}

async function dexFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`DexScreener request failed: ${res.status} ${res.statusText} (${path})`);
  }
  return (await res.json()) as T;
}

/** Fetch all known pairs for one or more Solana token mint addresses (max 30 per call). */
export async function getPairsForTokens(mintAddresses: string[]): Promise<DexScreenerPair[]> {
  if (mintAddresses.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < mintAddresses.length; i += 30) {
    chunks.push(mintAddresses.slice(i, i + 30));
  }
  const results: DexScreenerPair[] = [];
  for (const chunk of chunks) {
    const data = await dexFetch<DexScreenerTokensResponse>(
      `/latest/dex/tokens/${chunk.join(",")}`
    );
    if (data.pairs) results.push(...data.pairs);
  }
  return results;
}

export async function searchPairs(query: string): Promise<DexScreenerPair[]> {
  const data = await dexFetch<DexScreenerTokensResponse>(
    `/latest/dex/search?q=${encodeURIComponent(query)}`
  );
  return data.pairs ?? [];
}

/** Picks the pair with the deepest liquidity for a mint (most reliable price/volume source). */
export function pickPrimaryPair(pairs: DexScreenerPair[], mintAddress: string): DexScreenerPair | null {
  const candidates = pairs.filter(
    (p) => p.baseToken.address === mintAddress && p.chainId === "solana"
  );
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
}

export function pairToSnapshot(pair: DexScreenerPair): TokenMarketSnapshot {
  const now = Date.now();
  const ageSec = pair.pairCreatedAt ? Math.max(0, Math.floor((now - pair.pairCreatedAt) / 1000)) : undefined;
  const txns5m = pair.txns?.["m5"];
  return {
    tokenMint: pair.baseToken.address,
    symbol: pair.baseToken.symbol,
    priceUsd: pair.priceUsd ? Number(pair.priceUsd) : 0,
    liquidityUsd: pair.liquidity?.usd ?? 0,
    marketCapUsd: pair.marketCap,
    fdvUsd: pair.fdv,
    tokenAgeSec: ageSec,
    volume1mUsd: undefined, // DexScreener does not expose 1m volume; left for a finer-grained source
    volume5mUsd: pair.volume?.["m5"],
    volume15mUsd: undefined, // DexScreener does not expose a 15m bucket (m5 / h1 / h6 / h24 only)
    volume1hUsd: pair.volume?.["h1"],
    buyCount5m: txns5m?.buys,
    sellCount5m: txns5m?.sells,
    priceChange5mPct: pair.priceChange?.["m5"],
    priceChange1hPct: pair.priceChange?.["h1"],
  };
}

/** Convenience: fetch + resolve to a single best-guess snapshot for a mint. */
export async function getTokenSnapshot(mintAddress: string): Promise<TokenMarketSnapshot | null> {
  const pairs = await getPairsForTokens([mintAddress]);
  const primary = pickPrimaryPair(pairs, mintAddress);
  if (!primary) return null;
  return pairToSnapshot(primary);
}
