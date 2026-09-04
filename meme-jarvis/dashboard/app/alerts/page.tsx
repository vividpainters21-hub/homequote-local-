import Link from "next/link";
import { api, safeFetch } from "@/lib/api";
import { ErrorNote, PageHeader } from "@/components/UiBits";

export const dynamic = "force-dynamic";

const CATEGORY_COLOR: Record<string, string> = {
  SMART_MONEY_CLUSTER: "text-accent",
  HIGH_SCORE: "text-accent",
  RAPID_SCORE_INCREASE: "text-blue-400",
  SMART_MONEY_EXIT: "text-warn",
  WHALE_DUMP: "text-danger",
  LIQUIDITY_WARNING: "text-warn",
  RUG_WARNING: "text-danger",
  PAPER_ENTRY: "text-accent",
  PAPER_EXIT: "text-blue-400",
};

export default async function AlertsPage() {
  const { data: alerts, error } = await safeFetch(() => api.alerts(200));

  return (
    <div>
      <PageHeader title="Alerts" sub="Every alert Meme Jarvis has raised, mirrored to Telegram when configured." />
      <ErrorNote error={error} />

      <div className="flex flex-col gap-2">
        {(alerts ?? []).map((a: any) => (
          <div key={a.id} className="bg-panel border border-border rounded-lg p-3 flex items-center justify-between">
            <div>
              <span className={`font-medium mr-2 ${CATEGORY_COLOR[a.category] ?? "text-gray-300"}`}>{a.category.replace(/_/g, " ")}</span>
              {a.token?.symbol && (
                <Link href={`/tokens/${a.token.mintAddress}`} className="text-gray-400 hover:underline">
                  {a.token.symbol}
                </Link>
              )}
              <div className="text-xs text-gray-500 mt-1">{a.message.replace(/<[^>]+>/g, " ").slice(0, 160)}</div>
            </div>
            <div className="text-right text-xs text-gray-500">
              {new Date(a.createdAt).toLocaleString()}
              {a.telegramSent && <div className="text-accent">sent to Telegram</div>}
            </div>
          </div>
        ))}
        {(!alerts || alerts.length === 0) && <div className="text-gray-500">No alerts yet.</div>}
      </div>
    </div>
  );
}
