import { prisma } from "@meme-jarvis/database";
import { getActiveFomoConnector, type FomoRawEvent } from "@meme-jarvis/fomo-connector";

const connector = getActiveFomoConnector();

/** Persists raw Fomo capture payloads and extracts trader/token/trade data via the heuristic connector. */
export async function ingestFomoEvents(rawEvents: FomoRawEvent[]): Promise<{ stored: number; tradesCreated: number }> {
  let tradesCreated = 0;

  for (const rawEvent of rawEvents) {
    const fomoEventRow = await prisma.fomoEvent.create({
      data: { rawPayload: rawEvent as unknown as object, processed: false },
    });

    try {
      const normalized = connector.normalize(rawEvent);

      for (const event of normalized) {
        if (event.confidence !== "high" || !event.walletAddress || !event.tokenMint || !event.side) continue;

        const wallet = await prisma.wallet.upsert({
          where: { address: event.walletAddress },
          create: { address: event.walletAddress, fomoUsername: event.traderUsername, lastSeenAt: new Date(event.occurredAt) },
          update: { fomoUsername: event.traderUsername ?? undefined, lastSeenAt: new Date(event.occurredAt) },
        });

        const token = await prisma.token.upsert({
          where: { mintAddress: event.tokenMint },
          create: { mintAddress: event.tokenMint, symbol: event.tokenSymbol },
          update: event.tokenSymbol ? { symbol: event.tokenSymbol } : {},
        });

        await prisma.trade.create({
          data: {
            walletId: wallet.id,
            tokenId: token.id,
            side: event.side,
            source: "FOMO",
            amountTokens: event.amountTokens,
            valueUsd: event.valueUsd,
            priceUsd: event.priceUsd,
            txSignature: event.txSignature,
            traderPnlUsd: event.traderPnlUsd,
            traderWinRatePct: event.traderWinRatePct,
            occurredAt: new Date(event.occurredAt),
          },
        });
        tradesCreated++;
      }

      await prisma.fomoEvent.update({ where: { id: fomoEventRow.id }, data: { processed: true } });
    } catch (err) {
      await prisma.fomoEvent.update({
        where: { id: fomoEventRow.id },
        data: { processingError: String((err as Error).message || err) },
      });
    }
  }

  return { stored: rawEvents.length, tradesCreated };
}
