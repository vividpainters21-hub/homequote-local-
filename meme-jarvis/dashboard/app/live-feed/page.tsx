import { api, safeFetch } from "@/lib/api";
import { ErrorNote, fmtUsd, PageHeader, ScoreBadge } from "@/components/UiBits";

export const dynamic = "force-dynamic";

export default async function LiveFeedPage() {
  const { data: feed, error } = await safeFetch(() => api.fomoFeed(100));

  return (
    <div>
      <PageHeader
        title="Live Fomo Feed"
        sub="Raw trades captured by the Fomo browser extension (undocumented, best-effort integration — see /fomo-connector/extension/README.md)."
      />
      <ErrorNote error={error} />

      <div className="bg-panel border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-border">
              <th className="p-3">Time</th>
              <th className="p-3">Trader</th>
              <th className="p-3">Score</th>
              <th className="p-3">Token</th>
              <th className="p-3">Side</th>
              <th className="p-3">Value</th>
              <th className="p-3">Price</th>
            </tr>
          </thead>
          <tbody>
            {(feed ?? []).map((t: any) => (
              <tr key={t.id} className="border-b border-border/50">
                <td className="p-3 text-gray-500">{new Date(t.occurredAt).toLocaleTimeString()}</td>
                <td className="p-3 text-gray-200">{t.fomoUsername ?? `${t.wallet.slice(0, 6)}…`}</td>
                <td className="p-3">
                  <ScoreBadge score={t.traderScore} kind="opportunity" />
                </td>
                <td className="p-3 text-gray-200">{t.token}</td>
                <td className={`p-3 ${t.side === "BUY" ? "text-accent" : "text-danger"}`}>{t.side}</td>
                <td className="p-3 text-gray-300">{fmtUsd(t.valueUsd)}</td>
                <td className="p-3 text-gray-300">{fmtUsd(t.priceUsd)}</td>
              </tr>
            ))}
            {(!feed || feed.length === 0) && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  No Fomo activity captured yet. Install the extension in /fomo-connector/extension and enable it on your Fomo tab.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
