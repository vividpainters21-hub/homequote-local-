import type { FastifyInstance } from "fastify";
import { prisma } from "@meme-jarvis/database";
import { getTopTraders } from "@meme-jarvis/wallet-intelligence";

export async function traderRoutes(app: FastifyInstance) {
  app.get("/api/traders", async (request) => {
    const { limit, requireSampleSizeOk } = request.query as { limit?: string; requireSampleSizeOk?: string };
    return getTopTraders({
      limit: limit ? Number(limit) : undefined,
      requireSampleSizeOk: requireSampleSizeOk ? requireSampleSizeOk === "true" : undefined,
    });
  });

  app.get("/api/traders/:address", async (request, reply) => {
    const { address } = request.params as { address: string };
    const wallet = await prisma.wallet.findUnique({ where: { address }, include: { scoreHistory: { orderBy: { recordedAt: "desc" }, take: 60 } } });
    if (!wallet) return reply.code(404).send({ error: "Wallet not found" });
    return wallet;
  });

  app.get("/api/traders/:address/trades", async (request, reply) => {
    const { address } = request.params as { address: string };
    const { limit } = request.query as { limit?: string };
    const wallet = await prisma.wallet.findUnique({ where: { address } });
    if (!wallet) return reply.code(404).send({ error: "Wallet not found" });
    return prisma.trade.findMany({
      where: { walletId: wallet.id },
      orderBy: { occurredAt: "desc" },
      take: Number(limit ?? 100),
      include: { token: true },
    });
  });

  app.get("/api/traders/exiting", async () => {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const sells = await prisma.trade.findMany({
      where: { side: "SELL", occurredAt: { gte: fifteenMinAgo }, wallet: { sampleSizeOk: true, traderScore: { gte: 60 } } },
      include: { wallet: true, token: true },
      orderBy: { occurredAt: "desc" },
      take: 50,
    });
    return sells;
  });
}
