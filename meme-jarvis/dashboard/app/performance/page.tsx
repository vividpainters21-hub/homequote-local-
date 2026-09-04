import { api, safeFetch } from "@/lib/api";
import { ErrorNote, fmtPct, fmtUsd, PageHeader, StatCard } from "@/components/UiBits";

export const dynamic = "force-dynamic";

function BreakdownTable({ title, rows }: { title: string; rows: any[] }) {
  return (
    <section className="bg-panel border border-border rounded-lg p-4">
      <h2 className="font-semibold text-white mb-3">{title}</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-border">
            <th className="p-2">Bucket</th>
            <th className="p-2">Trades</th>
            <th className="p-2">Win rate</th>
            <th className="p-2">Avg return</th>
            <th className="p-2">Total PnL</th>
          </tr>
        </thead>
        <tbody>
          {(rows ?? []).map((r) => (
            <tr key={r.bucket} className="border-b border-border/40">
              <td className="p-2 text-gray-200">{r.bucket}</td>
              <td className="p-2 text-gray-300">{r.trades}</td>
              <td className="p-2 text-gray-300">{r.winRate.toFixed(0)}%</td>
              <td className={`p-2 ${r.avgReturnPct >= 0 ? "text-accent" : "text-danger"}`}>{fmtPct(r.avgReturnPct)}</td>
              <td className={`p-2 ${r.totalPnlUsd >= 0 ? "text-accent" : "text-danger"}`}>{fmtUsd(r.totalPnlUsd)}</td>
            </tr>
          ))}
          {(!rows || rows.length === 0) && (
            <tr>
              <td colSpan={5} className="p-4 text-center text-gray-500">
                Not enough data yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

export default async function PerformancePage() {
  const { data: analytics, error } = await safeFetch(() => api.paperAnalytics());

  return (
    <div>
      <PageHeader
        title="Performance"
        sub="Whether the strategy is actually profitable — not just whether individual signals look good. This system does not target or claim a 100% win rate."
      />
      <ErrorNote error={error} />

      {analytics && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total trades" value={analytics.totalTrades} />
            <StatCard label="Win rate" value={`${analytics.winRate.toFixed(0)}%`} sub={`${analytics.wins}W / ${analytics.losses}L`} />
            <StatCard label="Profit factor" value={Number.isFinite(analytics.profitFactor) ? analytics.profitFactor.toFixed(2) : "∞"} />
            <StatCard label="Expectancy / trade" value={fmtUsd(analytics.expectancyUsd)} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total PnL" value={fmtUsd(analytics.totalPnlUsd)} />
            <StatCard label="ROI" value={fmtPct(analytics.roiPct)} />
            <StatCard label="Max drawdown" value={fmtUsd(analytics.maxDrawdownUsd)} />
            <StatCard label="Sharpe-like ratio" value={analytics.sharpeLike.toFixed(2)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BreakdownTable title="Performance by opportunity score range" rows={analytics.byScoreRange} />
            <BreakdownTable title="Performance by token age at entry" rows={analytics.byTokenAge} />
            <BreakdownTable title="Performance by liquidity" rows={analytics.byLiquidity} />
            <BreakdownTable title="Performance by smart-wallet count" rows={analytics.bySmartWalletCount} />
            <BreakdownTable title="Performance by time of day (UTC)" rows={analytics.byTimeOfDay} />
            <BreakdownTable title="Performance by exit strategy" rows={analytics.byExitStrategy} />
          </div>
        </>
      )}
    </div>
  );
}
