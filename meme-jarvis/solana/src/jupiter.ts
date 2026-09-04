/**
 * Jupiter Quote API — used read-only, to test whether a sell route exists
 * for a token and estimate slippage, WITHOUT ever submitting a transaction.
 * Official docs: https://station.jup.ag/docs/apis/swap-api
 */

const QUOTE_API_BASE = "https://quote-api.jup.ag/v6";
const WSOL_MINT = "So11111111111111111111111111111111111111112";

export interface JupiterQuote {
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: unknown[];
}

/**
 * Requests a quote to sell `amountRaw` (base units) of `mintAddress` into
 * SOL. If this throws or returns no route, the token likely has no sellable
 * liquidity right now (a strong rug/honeypot signal for the risk engine).
 */
export async function getSellQuote(mintAddress: string, amountRaw: string): Promise<JupiterQuote | null> {
  try {
    const params = new URLSearchParams({
      inputMint: mintAddress,
      outputMint: WSOL_MINT,
      amount: amountRaw,
      slippageBps: "500",
    });
    const res = await fetch(`${QUOTE_API_BASE}/quote?${params.toString()}`);
    if (!res.ok) return null;
    const data = (await res.json()) as JupiterQuote & { errorCode?: string };
    if (data.errorCode) return null;
    return data;
  } catch {
    return null;
  }
}

/** True if a sell route exists at all (liquidity to exit), false if the token appears untradeable. */
export async function canSellToken(mintAddress: string, amountRaw: string): Promise<boolean> {
  const quote = await getSellQuote(mintAddress, amountRaw);
  return quote !== null && Number(quote.outAmount) > 0;
}
