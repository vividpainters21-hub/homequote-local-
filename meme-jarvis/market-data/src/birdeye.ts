import type { TokenHolderInfo, TokenMarketSnapshot } from "@meme-jarvis/shared";

/**
 * Birdeye API client — OPTIONAL. Only used when BIRDEYE_API_KEY is set, to
 * fill gaps DEX Screener doesn't cover (finer volume buckets, holder lists).
 * Official docs: https://docs.birdeye.so/
 */

const BASE_URL = "https://public-api.birdeye.so";

export function isBirdeyeConfigured(): boolean {
  return Boolean(process.env.BIRDEYE_API_KEY);
}

async function birdeyeFetch<T>(path: string): Promise<T> {
  const apiKey = process.env.BIRDEYE_API_KEY;
  if (!apiKey) {
    throw new Error("BIRDEYE_API_KEY is not set; Birdeye is optional and disabled.");
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "X-API-KEY": apiKey,
      "x-chain": "solana",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Birdeye request failed: ${res.status} ${res.statusText} (${path})`);
  }
  return (await res.json()) as T;
}

interface BirdeyeOverviewResponse {
  data: {
    price: number;
    liquidity: number;
    mc: number;
    v1mUSD?: number;
    v5mUSD?: number;
    v15mUSD?: number;
    v1hUSD?: number;
    uniqueWallet5m?: number;
    trade5m?: number;
    buy5m?: number;
    sell5m?: number;
    priceChange5mPercent?: number;
    priceChange1hPercent?: number;
  };
  success: boolean;
}

export async function getBirdeyeOverview(mintAddress: string): Promise<Partial<TokenMarketSnapshot> | null> {
  try {
    const res = await birdeyeFetch<BirdeyeOverviewResponse>(
      `/defi/token_overview?address=${mintAddress}`
    );
    if (!res.success) return null;
    const d = res.data;
    return {
      priceUsd: d.price,
      liquidityUsd: d.liquidity,
      marketCapUsd: d.mc,
      volume1mUsd: d.v1mUSD,
      volume5mUsd: d.v5mUSD,
      volume15mUsd: d.v15mUSD,
      volume1hUsd: d.v1hUSD,
      uniqueBuyers5m: d.uniqueWallet5m,
      buyCount5m: d.buy5m,
      sellCount5m: d.sell5m,
      priceChange5mPct: d.priceChange5mPercent,
      priceChange1hPct: d.priceChange1hPercent,
    };
  } catch {
    return null;
  }
}

interface BirdeyeHolderResponse {
  data: { items: Array<{ owner: string; ui_amount: number }> };
  success: boolean;
}

export async function getTopHolders(mintAddress: string, totalSupply: number): Promise<TokenHolderInfo[]> {
  try {
    const res = await birdeyeFetch<BirdeyeHolderResponse>(
      `/defi/v3/token/holder?address=${mintAddress}&offset=0&limit=20`
    );
    if (!res.success || totalSupply <= 0) return [];
    return res.data.items.map((h) => ({
      address: h.owner,
      pctOfSupply: (h.ui_amount / totalSupply) * 100,
    }));
  } catch {
    return [];
  }
}
