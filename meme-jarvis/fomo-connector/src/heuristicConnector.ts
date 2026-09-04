import type { FomoActivityEvent, FomoConnector, FomoRawEvent } from "./types.js";
import { findItemArray, flattenKeys, pickField } from "./fieldMap.js";

function toIsoTimestamp(value: unknown, fallback: string): string {
  if (typeof value === "number") {
    // Heuristic: treat values below 10^12 as seconds, otherwise milliseconds.
    const ms = value < 1e12 ? value * 1000 : value;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return fallback;
}

function toSide(value: unknown): "BUY" | "SELL" | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.toLowerCase();
  if (v.includes("buy") || v.includes("long")) return "BUY";
  if (v.includes("sell") || v.includes("short")) return "SELL";
  return undefined;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/[^0-9.\-]/g, ""));
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

function toStr(value: unknown): string | undefined {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : undefined;
}

/**
 * Best-effort connector for the browser-extension network/DOM capture path.
 * This is explicitly the UNDOCUMENTED integration: it guesses field names
 * from whatever JSON shape Fomo happens to be using today. If Fomo changes
 * their frontend, only fieldMap.ts needs updating — every other Meme Jarvis
 * module is unaffected because they all consume FomoActivityEvent, not raw
 * Fomo payloads.
 */
export class HeuristicFomoConnector implements FomoConnector {
  readonly method = "extension-network" as const;

  normalize(rawEvent: FomoRawEvent): FomoActivityEvent[] {
    const items = findItemArray(rawEvent.raw) ?? [rawEvent.raw];
    const events: FomoActivityEvent[] = [];

    for (const item of items) {
      if (item === null || typeof item !== "object") continue;
      const flat = flattenKeys(item);

      const walletAddress = toStr(pickField(flat, "walletAddress"));
      const tokenMint = toStr(pickField(flat, "tokenMint"));
      const side = toSide(pickField(flat, "side"));
      const amountTokens = toNumber(pickField(flat, "amountTokens"));
      const valueUsd = toNumber(pickField(flat, "valueUsd"));
      const occurredAt = toIsoTimestamp(pickField(flat, "occurredAt"), rawEvent.capturedAt);

      const event: FomoActivityEvent = {
        traderUsername: toStr(pickField(flat, "traderUsername")),
        walletAddress,
        tokenMint,
        tokenSymbol: toStr(pickField(flat, "tokenSymbol")),
        side,
        amountTokens,
        valueUsd,
        priceUsd: toNumber(pickField(flat, "priceUsd")),
        txSignature: toStr(pickField(flat, "txSignature")),
        traderPnlUsd: toNumber(pickField(flat, "traderPnlUsd")),
        traderWinRatePct: toNumber(pickField(flat, "traderWinRatePct")),
        occurredAt,
        confidence:
          walletAddress && tokenMint && side && (amountTokens !== undefined || valueUsd !== undefined)
            ? "high"
            : "low",
      };

      // Skip payloads where we couldn't extract anything meaningful at all
      // (e.g. UI/analytics noise picked up by the network interceptor).
      if (event.tokenMint || event.walletAddress || event.traderUsername) {
        events.push(event);
      }
    }

    return events;
  }
}
