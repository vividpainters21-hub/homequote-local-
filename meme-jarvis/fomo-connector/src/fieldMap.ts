/**
 * Fomo ships no schema for its feed payloads, so we can't hard-code exact
 * JSON paths. Instead we flatten each captured item to a lowercase key->value
 * map and match against a list of *candidate* key names per target field.
 *
 * If Fomo's frontend changes its field names, add the new name to the
 * relevant candidate list below — no other code changes needed.
 */
export const FIELD_CANDIDATES: Record<string, string[]> = {
  traderUsername: ["username", "user", "trader", "handle", "displayname", "name", "author"],
  walletAddress: ["walletaddress", "wallet", "traderwallet", "owneraddress", "publickey"],
  tokenMint: ["mint", "tokenmint", "tokenaddress", "contractaddress", "ca", "mintaddress"],
  tokenSymbol: ["symbol", "ticker", "tokensymbol"],
  side: ["side", "type", "action", "direction", "tradetype"],
  amountTokens: ["amount", "tokenamount", "qty", "quantity", "tokensamount"],
  valueUsd: ["valueusd", "usdvalue", "amountusd", "value", "solvalueusd"],
  priceUsd: ["priceusd", "price", "tokenprice"],
  txSignature: ["signature", "txsignature", "tx", "txhash", "hash"],
  traderPnlUsd: ["pnl", "pnlusd", "profit", "realizedpnl"],
  traderWinRatePct: ["winrate", "win_rate", "winratepct", "successrate"],
  occurredAt: ["timestamp", "time", "createdat", "ts", "date", "occurredat"],
};

/** Recursively flattens an object into { lowercasedKey: value }, last-key-wins, depth-limited. */
export function flattenKeys(obj: unknown, depth = 0, out: Record<string, unknown> = {}): Record<string, unknown> {
  if (depth > 4 || obj === null || typeof obj !== "object" || Array.isArray(obj)) return out;
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase().replace(/[_-]/g, "");
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      flattenKeys(value, depth + 1, out);
    } else if (!(normalizedKey in out)) {
      out[normalizedKey] = value;
    }
  }
  return out;
}

export function pickField(flat: Record<string, unknown>, targetField: keyof typeof FIELD_CANDIDATES): unknown {
  for (const candidate of FIELD_CANDIDATES[targetField]) {
    const normalized = candidate.toLowerCase().replace(/[_-]/g, "");
    if (normalized in flat && flat[normalized] !== undefined && flat[normalized] !== null) {
      return flat[normalized];
    }
  }
  return undefined;
}

/** Finds the first array of plausible "feed item" objects nested inside a payload (BFS, depth-limited). */
export function findItemArray(payload: unknown, depth = 0): unknown[] | null {
  if (depth > 5) return null;
  if (Array.isArray(payload)) {
    if (payload.length > 0 && typeof payload[0] === "object" && payload[0] !== null) return payload;
    return null;
  }
  if (payload !== null && typeof payload === "object") {
    for (const value of Object.values(payload as Record<string, unknown>)) {
      const found = findItemArray(value, depth + 1);
      if (found) return found;
    }
  }
  return null;
}
