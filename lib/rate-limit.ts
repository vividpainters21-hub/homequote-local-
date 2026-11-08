import 'server-only';

const hits = new Map<string, number[]>();

/**
 * Best-effort, in-memory sliding-window limit per IP. Each server instance keeps its
 * own counts, so this stops casual abuse (bots running up the AI bill), not a
 * determined attacker. Put Vercel's firewall rate limiting in front for that.
 */
export function rateLimit(request: Request, key: string, limit: number, windowMs: number) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  const id = `${key}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(id) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(id, recent);
    return { ok: false as const, ip };
  }
  recent.push(now);
  hits.set(id, recent);
  if (hits.size > 5000) {
    for (const [k, times] of hits) if (!times.some((t) => now - t < windowMs)) hits.delete(k);
  }
  return { ok: true as const, ip };
}
