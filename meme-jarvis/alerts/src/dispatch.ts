import { prisma } from "@meme-jarvis/database";
import type { AlertCategory } from "@meme-jarvis/shared";
import { isTelegramConfigured, sendTelegramMessage } from "./telegram.js";

export interface DispatchAlertParams {
  category: AlertCategory;
  message: string;
  tokenId?: string;
  clusterId?: string;
  payload?: unknown;
}

/** Records an alert in the database (always) and sends it to Telegram (if configured). */
export async function dispatchAlert(params: DispatchAlertParams) {
  const alert = await prisma.alert.create({
    data: {
      category: params.category,
      tokenId: params.tokenId,
      clusterId: params.clusterId,
      message: params.message,
      payload: params.payload as object | undefined,
    },
  });

  if (isTelegramConfigured()) {
    const result = await sendTelegramMessage(params.message);
    if (result.ok) {
      await prisma.alert.update({
        where: { id: alert.id },
        data: { telegramSent: true, telegramMessageId: result.messageId },
      });
    }
  }

  return alert;
}

export async function getRecentAlerts(limit = 50) {
  return prisma.alert.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { token: true, cluster: true },
  });
}
