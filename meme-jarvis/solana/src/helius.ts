/**
 * Helius Enhanced Transactions + Webhooks API client.
 * Official docs: https://docs.helius.dev/solana-apis/enhanced-transactions-api
 *                https://docs.helius.dev/webhooks-and-websockets/webhooks
 */

const API_BASE = "https://api.helius.xyz";

function requireApiKey(): string {
  const key = process.env.HELIUS_API_KEY;
  if (!key) throw new Error("HELIUS_API_KEY is not set");
  return key;
}

export interface HeliusEnhancedTransaction {
  signature: string;
  timestamp: number;
  type: string;
  source: string;
  fee: number;
  feePayer: string;
  tokenTransfers: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    mint: string;
    tokenAmount: number;
  }>;
  nativeTransfers: Array<{ fromUserAccount: string; toUserAccount: string; amount: number }>;
  description?: string;
}

/** Parsed, human-readable transaction history for a wallet or token account. */
export async function getEnhancedTransactionsForAddress(
  address: string,
  opts: { limit?: number; before?: string } = {}
): Promise<HeliusEnhancedTransaction[]> {
  const key = requireApiKey();
  const params = new URLSearchParams({ "api-key": key });
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.before) params.set("before", opts.before);
  const res = await fetch(`${API_BASE}/v0/addresses/${address}/transactions?${params.toString()}`);
  if (!res.ok) throw new Error(`Helius transactions request failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as HeliusEnhancedTransaction[];
}

/** Parse a specific batch of transaction signatures (max 100 per Helius docs). */
export async function parseTransactions(signatures: string[]): Promise<HeliusEnhancedTransaction[]> {
  const key = requireApiKey();
  const res = await fetch(`${API_BASE}/v0/transactions?api-key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactions: signatures.slice(0, 100) }),
  });
  if (!res.ok) throw new Error(`Helius parse-transactions failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as HeliusEnhancedTransaction[];
}

export interface HeliusWebhook {
  webhookID: string;
  wallet: string;
  webhookURL: string;
  transactionTypes: string[];
  accountAddresses: string[];
  webhookType: string;
}

/** Register a webhook so on-chain swaps for tracked wallets/tokens push to our API in near-real-time. */
export async function createWebhook(params: {
  webhookURL: string;
  accountAddresses: string[];
  transactionTypes?: string[];
}): Promise<HeliusWebhook> {
  const key = requireApiKey();
  const res = await fetch(`${API_BASE}/v0/webhooks?api-key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      webhookURL: params.webhookURL,
      transactionTypes: params.transactionTypes ?? ["SWAP"],
      accountAddresses: params.accountAddresses,
      webhookType: "enhanced",
    }),
  });
  if (!res.ok) throw new Error(`Helius create-webhook failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as HeliusWebhook;
}

export async function listWebhooks(): Promise<HeliusWebhook[]> {
  const key = requireApiKey();
  const res = await fetch(`${API_BASE}/v0/webhooks?api-key=${key}`);
  if (!res.ok) throw new Error(`Helius list-webhooks failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as HeliusWebhook[];
}

export async function updateWebhookAddresses(webhookId: string, accountAddresses: string[]): Promise<HeliusWebhook> {
  const key = requireApiKey();
  const res = await fetch(`${API_BASE}/v0/webhooks/${webhookId}?api-key=${key}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountAddresses }),
  });
  if (!res.ok) throw new Error(`Helius update-webhook failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as HeliusWebhook;
}

export function isHeliusConfigured(): boolean {
  return Boolean(process.env.HELIUS_API_KEY);
}
