/**
 * Telegram Bot API client. Official docs: https://core.telegram.org/bots/api
 * Create a bot with @BotFather to get TELEGRAM_BOT_TOKEN, then message the
 * bot (or add it to a group) and call getUpdates once to find your chat id
 * for TELEGRAM_CHAT_ID — documented in the root README.
 */

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export async function sendTelegramMessage(text: string): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return { ok: false, error: "Telegram is not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID missing)." };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    const data = (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
    if (!data.ok) return { ok: false, error: data.description ?? "Unknown Telegram API error" };
    return { ok: true, messageId: String(data.result?.message_id) };
  } catch (err) {
    return { ok: false, error: String((err as Error).message || err) };
  }
}
