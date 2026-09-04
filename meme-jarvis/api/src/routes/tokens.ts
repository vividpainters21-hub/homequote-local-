import type { FastifyInstance } from "fastify";
import { prisma } from "@meme-jarvis/database";

export async function tokenRoutes(app: FastifyInstance) {
  app.get("/api/tokens", async (request) => {
    const { minScore, maxRisk, limit } = request.query as { minScore?: string; maxRisk?: string; limit?: string };
    const take = Number(limit ?? 100);

    const tokens = await prisma.token.findMany({
      take,
      orderBy: { updatedAt: "desc" },
      include: {
        snapshots: { orderBy: { recordedAt: "desc" }, take: 1 },
        opportunityScores: { orderBy: { computedAt: "desc" }, take: 1 },
        riskAssessments: { orderBy: { computedAt: "desc" }, take: 1 },
      },
    });

    const shaped = tokens
      .map((t) => {
        const snapshot = t.snapshots[0];
        const opportunity = t.opportunityScores[0];
        const risk = t.riskAssessments[0];
        return {
          mint: t.mintAddress,
          symbol: t.symbol,
          name: t.name,
          priceUsd: snapshot?.priceUsd,
          liquidityUsd: snapshot?.liquidityUsd,
          marketCapUsd: snapshot?.marketCapUsd,
          volume5mUsd: snapshot?.volume5mUsd,
          buyCount5m: snapshot?.buyCount5m,
          sellCount5m: snapshot?.sellCount5m,
          buySellRatio: snapshot?.sellCount5m ? (snapshot.buyCount5m ?? 0) / snapshot.sellCount5m : null,
          tokenCreatedAt: t.tokenCreatedAt,
          opportunityScore: opportunity?.score ?? null,
          status: opportunity?.status ?? null,
          riskScore: risk?.riskScore ?? null,
          criticalDisqualified: risk?.criticalDisqualified ?? false,
        };
      })
      .filter((t) => (minScore ? (t.opportunityScore ?? 0) >= Number(minScore) : true))
      .filter((t) => (maxRisk ? (t.riskScore ?? 100) <= Number(maxRisk) : true))
      .sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0));

    return shaped;
  });

  app.get("/api/tokens/:mint", async (request, reply) => {
    const { mint } = request.params as { mint: string };
    const token = await prisma.token.findUnique({
      where: { mintAddress: mint },
      include: {
        snapshots: { orderBy: { recordedAt: "desc" }, take: 50 },
        opportunityScores: { orderBy: { computedAt: "desc" }, take: 20 },
        riskAssessments: { orderBy: { computedAt: "desc" }, take: 5 },
        holders: { orderBy: { recordedAt: "desc" }, take: 1 },
        clusters: { orderBy: { createdAt: "desc" }, take: 10, include: { members: { include: { wallet: true } } } },
        trades: { orderBy: { occurredAt: "desc" }, take: 100, include: { wallet: true } },
      },
    });
    if (!token) return reply.code(404).send({ error: "Token not found" });
    return token;
  });

  app.get("/api/tokens/:mint/risk", async (request, reply) => {
    const { mint } = request.params as { mint: string };
    const token = await prisma.token.findUnique({ where: { mintAddress: mint } });
    if (!token) return reply.code(404).send({ error: "Token not found" });
    const risk = await prisma.riskAssessment.findFirst({ where: { tokenId: token.id }, orderBy: { computedAt: "desc" } });
    return risk ?? { error: "No risk assessment computed yet" };
  });
}
