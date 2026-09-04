import { Connection } from "@solana/web3.js";

let cached: Connection | null = null;

/**
 * Solana RPC connection. Prefers Helius (HELIUS_API_KEY) since the free
 * public RPC is heavily rate-limited and unsuitable for a live monitor.
 * Docs: https://docs.helius.dev/solana-rpc-nodes/what-is-an-rpc-node
 */
export function getConnection(): Connection {
  if (cached) return cached;
  const heliusKey = process.env.HELIUS_API_KEY;
  const endpoint = heliusKey
    ? `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`
    : process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  cached = new Connection(endpoint, "confirmed");
  return cached;
}
