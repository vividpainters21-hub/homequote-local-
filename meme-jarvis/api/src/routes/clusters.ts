import type { FastifyInstance } from "fastify";
import { prisma } from "@meme-jarvis/database";

export async function clusterRoutes(app: FastifyInstance) {
  app.get("/api/clusters", async (request) => {
    const { limit, minScore } = request.query as { limit?: string; minScore?: string };
    const clusters = await prisma.cluster.findMany({
      where: minScore ? { clusterScore: { gte: Number(minScore) } } : {},
      orderBy: { createdAt: "desc" },
      take: Number(limit ?? 50),
      include: { token: true, members: { include: { wallet: true } } },
    });
    return clusters;
  });

  app.get("/api/clusters/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const cluster = await prisma.cluster.findUnique({
      where: { id },
      include: { token: true, members: { include: { wallet: true } } },
    });
    if (!cluster) return reply.code(404).send({ error: "Cluster not found" });
    return cluster;
  });
}
