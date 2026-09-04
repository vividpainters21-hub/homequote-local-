const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export interface TokenSummary {
  mint: string;
  symbol: string | null;
  name: string | null;
  priceUsd?: number;
  liquidityUsd?: number;
  marketCapUsd?: number;
  volume5mUsd?: number;
  buyCount5m?: number;
  sellCount5m?: number;
  buySellRatio?: number | null;
  tokenCreatedAt?: string | null;
  opportunityScore: number | null;
  status: string | null;
  riskScore: number | null;
  criticalDisqualified: boolean;
}

export const api = {
  health: () => get<{ ok: boolean; time: string }>("/api/health"),
  marketOverview: () => get<any>("/api/market/overview"), // eslint-disable-line @typescript-eslint/no-explicit-any
  tokens: (params: { minScore?: number; maxRisk?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.minScore !== undefined) qs.set("minScore", String(params.minScore));
    if (params.maxRisk !== undefined) qs.set("maxRisk", String(params.maxRisk));
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    return get<TokenSummary[]>(`/api/tokens?${qs.toString()}`);
  },
  token: (mint: string) => get<any>(`/api/tokens/${mint}`), // eslint-disable-line @typescript-eslint/no-explicit-any
  traders: (limit = 50) => get<any[]>(`/api/traders?limit=${limit}`), // eslint-disable-line @typescript-eslint/no-explicit-any
  trader: (address: string) => get<any>(`/api/traders/${address}`), // eslint-disable-line @typescript-eslint/no-explicit-any
  tradersExiting: () => get<any[]>("/api/traders/exiting"), // eslint-disable-line @typescript-eslint/no-explicit-any
  clusters: (limit = 50) => get<any[]>(`/api/clusters?limit=${limit}`), // eslint-disable-line @typescript-eslint/no-explicit-any
  alerts: (limit = 50) => get<any[]>(`/api/alerts?limit=${limit}`), // eslint-disable-line @typescript-eslint/no-explicit-any
  fomoFeed: (limit = 50) => get<any[]>(`/api/fomo/feed?limit=${limit}`), // eslint-disable-line @typescript-eslint/no-explicit-any
  paperPortfolio: (account = "default") => get<any>(`/api/paper/portfolio?account=${account}`), // eslint-disable-line @typescript-eslint/no-explicit-any
  paperTrades: (account = "default", limit = 100) => get<any[]>(`/api/paper/trades?account=${account}&limit=${limit}`), // eslint-disable-line @typescript-eslint/no-explicit-any
  paperAnalytics: (account = "default") => get<any>(`/api/paper/analytics?account=${account}`), // eslint-disable-line @typescript-eslint/no-explicit-any
  paperSettings: (account = "default") => get<any>(`/api/paper/settings?account=${account}`), // eslint-disable-line @typescript-eslint/no-explicit-any
};

/** Wraps a fetch so a page can render gracefully (with a clear message) when the API isn't reachable yet. */
export async function safeFetch<T>(fn: () => Promise<T>): Promise<{ data: T | null; error: string | null }> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (err) {
    return { data: null, error: String((err as Error).message || err) };
  }
}
