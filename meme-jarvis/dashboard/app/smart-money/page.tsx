import Link from "next/link";
import { api, safeFetch } from "@/lib/api";
import { ErrorNote, fmtUsd, PageHeader, ScoreBadge } from "@/components/UiBits";

export const dynamic = "force-dynamic";

export default async function SmartMoneyPage() {
  const { data: traders, error } = await safeFetch(() => api.traders(50));
  const { data: exiting } = await safeFetch(() => api.tradersExiting());

  return (
    <div>
      <PageHeader title="Smart Money" sub="Our own trader-ranking — not a label borrowed from Fomo or anywhere else." />
      <ErrorNote error={error} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-panel border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-border">
                <th className="p-3">Trader</th>
                <th className="p-3">Score</th>
                <th className="p-3">Win rate</th>
                <th className="p-3">Trades</th>
                <th className="p-3">Realized PnL</th>
                <th className="p-3">Profit factor</th>
                <th className="p-3">7d</th>
                <th className="p-3">30d</th>
              </tr>
            </thead>
            <tbody>
              {(traders ?? []).map((t: any) => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-white/5">
                  <td className="p-3">
                    <Link href={`/smart-money/${t.address}`} className="text-white hover:underline">
                      {t.fomoUsername ?? `${t.address.slice(0, 6)}…`}
                    </Link>
                  </td>
                  <td className="p-3">
                    <ScoreBadge score={t.traderScore} kind="opportunity" />
                  </td>
                  <td className="p-3 text-gray-300">{t.winRate.toFixed(0)}%</td>
                  <td className="p-3 text-gray-300">{t.totalTrades}</td>
                  <td className={`p-3 ${t.realizedPnlUsd >= 0 ? "text-accent" : "text-danger"}`}>{fmtUsd(t.realizedPnlUsd)}</td>
                  <td className="p-3 text-gray-300">{t.profitFactor.toFixed(2)}</td>
                  <td className={`p-3 ${t.perf7dPct >= 0 ? "text-accent" : "text-danger"}`}>{t.perf7dPct.toFixed(0)}%</td>
                  <td className={`p-3 ${t.perf30dPct >= 0 ? "text-accent" : "text-danger"}`}>{t.perf30dPct.toFixed(0)}%</td>
                </tr>
              ))}
              {(!traders || traders.length === 0) && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-500">
                    No traders have enough sample size yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="bg-panel border border-border rounded-lg p-4">
          <h2 className="font-semibold text-white mb-3">Recently exiting (15m)</h2>
          <div className="flex flex-col gap-2">
            {(exiting ?? []).map((s: any) => (
              <div key={s.id} className="text-sm border-b border-border/50 pb-2 last:border-0">
                <div className="flex justify-between">
                  <span className="text-gray-200">{s.wallet.fomoUsername ?? s.wallet.address.slice(0, 6)}</span>
                  <ScoreBadge score={s.wallet.traderScore} kind="opportunity" />
                </div>
                <div className="text-xs text-gray-500">
                  Sold {s.token.symbol ?? s.token.mintAddress.slice(0, 6)} · {fmtUsd(s.valueUsd)}
                </div>
              </div>
            ))}
            {(!exiting || exiting.length === 0) && <div className="text-sm text-gray-500">No strong-trader exits recently.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
