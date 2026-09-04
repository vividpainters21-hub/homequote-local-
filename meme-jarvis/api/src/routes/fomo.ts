import type { FastifyInstance } from "fastify";
import { ingestFomoEvents } from "../ingest.js";
import { prisma } from "@meme-jarvis/database";
import type { FomoRawEvent } from "@meme-jarvis/fomo-connector";

export async function fomoRoutes(app: FastifyInstance) {
  app.post("/api/fomo/ingest", async (request, reply) => {
    const apiKey = request.headers["x-api-key"];
    const expected = process.env.FOMO_INGEST_API_KEY;
    if (expected && apiKey !== expected) {
      return reply.code(401).send({ error: "Invalid or missing API key" });
    }

    const body = request.body as { events?: unknown[] };
    if (!Array.isArray(body.events)) {
      return reply.code(400).send({ error: "Expected { events: [...] }" });
    }

    const result = await ingestFomoEvents(body.events as FomoRawEvent[]);
    app.wsBroadcast?.({ type: "fomo-ingest", ...result });
    return reply.send(result);
  });

  app.get("/api/fomo/feed", async (request) => {
    const limit = Number((request.query as { limit?: string }).limit ?? 50);
    const trades = await prisma.trade.findMany({
      where: { source: "FOMO" },
      orderBy: { occurredAt: "desc" },
      take: limit,
      include: { wallet: true, token: true },
    });
    return trades.map((t) => ({
      id: t.id,
      wallet: t.wallet.address,
      fomoUsername: t.wallet.fomoUsername,
      traderScore: t.wallet.traderScore,
      token: t.token.symbol ?? t.token.mintAddress,
      mint: t.token.mintAddress,
      side: t.side,
      amountTokens: t.amountTokens,
      valueUsd: t.valueUsd,
      priceUsd: t.priceUsd,
      occurredAt: t.occurredAt,
    }));
  });
}
