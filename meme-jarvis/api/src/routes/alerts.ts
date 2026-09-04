import type { FastifyInstance } from "fastify";
import { getRecentAlerts } from "@meme-jarvis/alerts";

export async function alertRoutes(app: FastifyInstance) {
  app.get("/api/alerts", async (request) => {
    const { limit } = request.query as { limit?: string };
    return getRecentAlerts(Number(limit ?? 50));
  });
}
