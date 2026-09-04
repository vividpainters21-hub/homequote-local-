import { api, safeFetch } from "@/lib/api";
import { ErrorNote, fmtUsd, PageHeader, ScoreBadge, StatCard } from "@/components/UiBits";

export const dynamic = "force-dynamic";

export default async function TraderDetailPage({ params }: { params: { address: string } }) {
  const { data: trader, error } = await safeFetch(() => api.trader(params.address));

  if (error) {
    return (
      <div>
        <PageHeader title="Trader profile" />
        <ErrorNote error={error} />
      </div>
    );
  }
  if (!trader) {
    return (
      <div>
        <PageHeader title="Trader profile" />
        <div className="text-gray-500">Wallet not found.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={trader.fomoUsername ?? trader.address} sub={trader.address} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Trader score" value={<ScoreBadge score={trader.traderScore} kind="opportunity" />} />
        <StatCard label="Win rate" value={`${trader.winRate.toFixed(0)}%`} />
        <StatCard label="Realized PnL" value={fmtUsd(trader.realizedPnlUsd)} />
        <StatCard label="Profit factor" value={trader.profitFactor.toFixed(2)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total trades" value={trader.totalTrades} sub={trader.sampleSizeOk ? "sample size OK" : "sample too small — score shrunk"} />
        <StatCard label="Max drawdown" value={`${trader.maxDrawdownPct.toFixed(0)}%`} />
        <StatCard label="Rugs purchased" value={trader.rugsPurchased} sub={`${trader.collapseRatePct.toFixed(0)}% collapse rate`} />
        <StatCard label="Avg hold time" value={`${Math.round(trader.avgHoldTimeSec / 60)}m`} />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="7-day performance" value={`${trader.perf7dPct.toFixed(0)}%`} />
        <StatCard label="30-day performance" value={`${trader.perf30dPct.toFixed(0)}%`} />
        <StatCard label="Lifetime performance" value={`${trader.perfLifetimePct.toFixed(0)}%`} />
      </div>

      <section className="bg-panel border border-border rounded-lg p-4">
        <h2 className="font-semibold text-white mb-3">Trader score history</h2>
        <div className="flex flex-col gap-1 text-sm">
          {(trader.scoreHistory ?? []).slice(0, 20).map((h: any) => (
            <div key={h.id} className="flex justify-between border-b border-border/40 pb-1">
              <span className="text-gray-500">{new Date(h.recordedAt).toLocaleString()}</span>
              <span className="text-gray-300">{h.traderScore.toFixed(1)}</span>
            </div>
          ))}
          {(!trader.scoreHistory || trader.scoreHistory.length === 0) && (
            <div className="text-gray-500">No history recorded yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}
