import { api, safeFetch } from "@/lib/api";
import { ErrorNote, fmtPct, fmtUsd, PageHeader, StatCard } from "@/components/UiBits";

export const dynamic = "force-dynamic";

export default async function PaperTradingPage() {
  const { data: portfolio, error } = await safeFetch(() => api.paperPortfolio());
  const { data: trades } = await safeFetch(() => api.paperTrades("default", 50));

  return (
    <div>
      <PageHeader
        title="Paper Trading"
        sub="Simulated trading only. There is no code path in this system that sends a real transaction — live trading defaults to OFF everywhere."
      />
      <ErrorNote error={error} />

      {portfolio && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Balance" value={fmtUsd(portfolio.account.currentBalanceUsd)} sub={`started at ${fmtUsd(portfolio.account.startingBalanceUsd)}`} />
          <StatCard label="Open positions" value={portfolio.positions.length} sub={`max ${portfolio.account.maxConcurrentPositions}`} />
          <StatCard label="Position size" value={fmtUsd(portfolio.account.positionSizeUsd)} />
          <StatCard label="Min score / Max risk" value={`${portfolio.account.minOpportunityScore} / ${portfolio.account.maxRiskScore}`} />
        </div>
      )}

      <section className="bg-panel border border-border rounded-lg p-4 mb-6">
        <h2 className="font-semibold text-white mb-3">Open positions</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-border">
              <th className="p-2">Token</th>
              <th className="p-2">Entry price</th>
              <th className="p-2">Size</th>
              <th className="p-2">High water mark</th>
              <th className="p-2">Opened</th>
            </tr>
          </thead>
          <tbody>
            {(portfolio?.positions ?? []).map((p: any) => (
              <tr key={p.id} className="border-b border-border/40">
                <td className="p-2 text-white">{p.token.symbol ?? p.token.mintAddress.slice(0, 6)}</td>
                <td className="p-2 text-gray-300">{fmtUsd(p.entryPriceUsd)}</td>
                <td className="p-2 text-gray-300">{fmtUsd(p.sizeUsd)}</td>
                <td className="p-2 text-gray-300">{fmtUsd(p.highWaterMarkUsd)}</td>
                <td className="p-2 text-gray-500">{new Date(p.openedAt).toLocaleString()}</td>
              </tr>
            ))}
            {(!portfolio?.positions || portfolio.positions.length === 0) && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">
                  No open positions.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="bg-panel border border-border rounded-lg p-4">
        <h2 className="font-semibold text-white mb-3">Trade history</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-border">
              <th className="p-2">Token</th>
              <th className="p-2">PnL</th>
              <th className="p-2">Return</th>
              <th className="p-2">MFE / MAE</th>
              <th className="p-2">Exit reason</th>
              <th className="p-2">Closed</th>
            </tr>
          </thead>
          <tbody>
            {(trades ?? []).map((t: any) => (
              <tr key={t.id} className="border-b border-border/40">
                <td className="p-2 text-white">{t.token.symbol ?? t.token.mintAddress.slice(0, 6)}</td>
                <td className={`p-2 ${t.pnlUsd >= 0 ? "text-accent" : "text-danger"}`}>{fmtUsd(t.pnlUsd)}</td>
                <td className={`p-2 ${t.returnPct >= 0 ? "text-accent" : "text-danger"}`}>{fmtPct(t.returnPct)}</td>
                <td className="p-2 text-gray-400">
                  {fmtPct(t.maxFavorableExcursionPct)} / {fmtPct(t.maxAdverseExcursionPct)}
                </td>
                <td className="p-2 text-gray-300">{t.exitReason}</td>
                <td className="p-2 text-gray-500">{new Date(t.closedAt).toLocaleString()}</td>
              </tr>
            ))}
            {(!trades || trades.length === 0) && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500">
                  No closed trades yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
