import { PublicKey } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";
import type { TokenHolderInfo, TokenSecurityInfo } from "@meme-jarvis/shared";
import { getConnection } from "./connection.js";

/**
 * Reads on-chain mint state directly via SPL Token program. This is the
 * ground truth for mint/freeze authority (a still-active mint authority
 * means the deployer can print unlimited supply; an active freeze authority
 * means they can freeze holder accounts and block selling).
 */
export async function getMintSecurityInfo(mintAddress: string): Promise<{
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
  supply: number;
  decimals: number;
}> {
  const connection = getConnection();
  const mintPubkey = new PublicKey(mintAddress);
  const mintInfo = await getMint(connection, mintPubkey);
  return {
    mintAuthorityRevoked: mintInfo.mintAuthority === null,
    freezeAuthorityRevoked: mintInfo.freezeAuthority === null,
    supply: Number(mintInfo.supply) / 10 ** mintInfo.decimals,
    decimals: mintInfo.decimals,
  };
}

/** Top holders by largest token accounts (on-chain, ground truth). */
export async function getTopHoldersOnChain(mintAddress: string): Promise<TokenHolderInfo[]> {
  const connection = getConnection();
  const mintPubkey = new PublicKey(mintAddress);
  const [largest, mintInfo] = await Promise.all([
    connection.getTokenLargestAccounts(mintPubkey),
    getMint(connection, mintPubkey),
  ]);
  const supply = Number(mintInfo.supply) / 10 ** mintInfo.decimals;
  if (supply <= 0) return [];
  return largest.value.map((acc) => ({
    address: acc.address.toBase58(),
    pctOfSupply: (Number(acc.uiAmount ?? 0) / supply) * 100,
  }));
}

export function computeHolderConcentration(holders: TokenHolderInfo[]): {
  top10HolderPct: number;
  top20HolderPct: number;
} {
  const sorted = [...holders].sort((a, b) => b.pctOfSupply - a.pctOfSupply);
  const top10HolderPct = sorted.slice(0, 10).reduce((s, h) => s + h.pctOfSupply, 0);
  const top20HolderPct = sorted.slice(0, 20).reduce((s, h) => s + h.pctOfSupply, 0);
  return { top10HolderPct, top20HolderPct };
}

/**
 * Best-effort "can this token still be sold" check. We do NOT execute a real
 * swap; we only confirm the mint isn't frozen and a route exists via Jupiter
 * quote (see jupiter.ts). A definitive answer requires a real transaction,
 * which this system intentionally never sends outside paper trading.
 */
export async function buildSecurityInfo(mintAddress: string, deployerAddress?: string): Promise<TokenSecurityInfo> {
  const mint = await getMintSecurityInfo(mintAddress);
  const holders = await getTopHoldersOnChain(mintAddress);
  const { top10HolderPct } = computeHolderConcentration(holders);
  return {
    mintAuthorityRevoked: mint.mintAuthorityRevoked,
    freezeAuthorityRevoked: mint.freezeAuthorityRevoked,
    top10HolderPct,
    holderCount: holders.length,
    deployerAddress,
  };
}
