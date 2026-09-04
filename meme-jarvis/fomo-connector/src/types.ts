/**
 * Fomo has no official public API as of this writing. This module defines a
 * stable internal contract (FomoConnector) so that however we get data in —
 * today's browser-extension capture, or an official API/webhook later — the
 * rest of Meme Jarvis never has to change.
 */

export type FomoCaptureMethod = "extension-network" | "extension-dom" | "official-api" | "manual";

/** Loosely-typed raw payload as captured by the extension. Shape is unknown
 * and may change any time Fomo ships a frontend update — treat as untrusted. */
export interface FomoRawEvent {
  capturedAt: string; // ISO timestamp, set client-side at capture time
  method: FomoCaptureMethod;
  sourceUrl?: string;
  raw: unknown;
}

/** Normalized activity event, after applying the field-mapping config to a raw payload. */
export interface FomoActivityEvent {
  traderUsername?: string;
  walletAddress?: string;
  tokenMint?: string;
  tokenSymbol?: string;
  side?: "BUY" | "SELL";
  amountTokens?: number;
  valueUsd?: number;
  priceUsd?: number;
  txSignature?: string;
  traderPnlUsd?: number;
  traderWinRatePct?: number;
  occurredAt: string; // ISO
  confidence: "high" | "low"; // "low" when required fields were missing/guessed
}

/** Pluggable connector interface. Swap implementations without touching downstream code. */
export interface FomoConnector {
  readonly method: FomoCaptureMethod;
  /** Turn one raw captured payload into zero or more normalized events. */
  normalize(rawEvent: FomoRawEvent): FomoActivityEvent[];
}
