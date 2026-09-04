import type { FastifyInstance } from "fastify";
import { prisma } from "@meme-jarvis/database";
import { listWeightConfigs, saveWeightConfig, activateWeightConfig } from "@meme-jarvis/scoring-engine";

export async function marketRoutes(app: FastifyInstance) {
  app.get("/api/market/overview", async () => {
    const [tokenCount, activeAlerts, topOpportunities, recentClusters, openPositions] = await Promise.all([
      prisma.token.count(),
      prisma.alert.count({ where: { createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } }),
      prisma.opportunityScore.findMany({
        orderBy: { computedAt: "desc" },
        take: 200,
        distinct: ["tokenId"],
        include: { token: true },
      }),
      prisma.cluster.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { token: true } }),
      prisma.paperPosition.count({ where: { status: "OPEN" } }),
    ]);

    const top10 = topOpportunities
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((o) => ({ mint: o.token.mintAddress, symbol: o.token.symbol, score: o.score, status: o.status }));

    return { tokenCount, alertsLastHour: activeAlerts, topOpportunities: top10, recentClusters, openPaperPositions: openPositions };
  });

  app.get("/api/scoring/weights", async () => listWeightConfigs());

  app.post("/api/scoring/weights", async (request) => {
    const { name, weights } = request.body as { name: string; weights: Record<string, number> };
    await saveWeightConfig(name, weights as never);
    return { ok: true };
  });

  app.post("/api/scoring/weights/:name/activate", async (request) => {
    const { name } = request.params as { name: string };
    await activateWeightConfig(name);
    return { ok: true };
  });
}
