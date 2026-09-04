import type { FastifyInstance } from "fastify";
import { prisma } from "@meme-jarvis/database";
import { computeAnalytics, getOrCreateAccount } from "@meme-jarvis/paper-trading";

export async function paperRoutes(app: FastifyInstance) {
  app.get("/api/paper/portfolio", async (request) => {
    const { account: accountName } = request.query as { account?: string };
    const account = await getOrCreateAccount(accountName ?? "default");
    const positions = await prisma.paperPosition.findMany({
      where: { accountId: account.id, status: "OPEN" },
      include: { token: true },
      orderBy: { openedAt: "desc" },
    });
    return { account, positions };
  });

  app.get("/api/paper/trades", async (request) => {
    const { account: accountName, limit } = request.query as { account?: string; limit?: string };
    const account = await getOrCreateAccount(accountName ?? "default");
    return prisma.paperTrade.findMany({
      where: { accountId: account.id },
      orderBy: { closedAt: "desc" },
      take: Number(limit ?? 100),
      include: { token: true },
    });
  });

  app.get("/api/paper/analytics", async (request) => {
    const { account: accountName } = request.query as { account?: string };
    return computeAnalytics(accountName ?? "default");
  });

  app.get("/api/paper/settings", async (request) => {
    const { account: accountName } = request.query as { account?: string };
    return getOrCreateAccount(accountName ?? "default");
  });

  app.put("/api/paper/settings", async (request) => {
    const { account: accountName } = request.query as { account?: string };
    const account = await getOrCreateAccount(accountName ?? "default");
    const body = request.body as Record<string, number | boolean>;
    return prisma.paperAccount.update({ where: { id: account.id }, data: body });
  });
}
