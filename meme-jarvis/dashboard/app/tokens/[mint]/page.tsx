import { api, safeFetch } from "@/lib/api";
import { ErrorNote, fmtPct, fmtUsd, PageHeader, ScoreBadge, StatCard, StatusPill } from "@/components/UiBits";

export const dynamic = "force-dynamic";

export default async function TokenDetailPage({ params }: { params: { mint: string } }) {
  const { data: token, error } = await safeFetch(() => api.token(params.mint));

  if (error) {
    return (
      <div>
        <PageHeader title="Token analysis" />
        <ErrorNote error={error} />
      </div>
    );
  }
  if (!token) {
    return (
      <div>
        <PageHeader title="Token analysis" />
        <div className="text-gray-500">Token not found.</div>
      </div>
    );
  }

  const snapshot = token.snapshots?.[0];
  const opportunity = token.opportunityScores?.[0];
  const risk = token.riskAssessments?.[0];
  const holders = token.holders?.[0];

  return (
    <div>
      <PageHeader title={token.symbol ?? token.mintAddress} sub={token.mintAddress} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Price" value={fmtUsd(snapshot?.priceUsd)} />
        <StatCard label="Liquidity" value={fmtUsd(snapshot?.liquidityUsd)} />
        <StatCard label="Market cap" value={fmtUsd(snapshot?.marketCapUsd)} />
        <StatCard label="5m volume" value={fmtUsd(snapshot?.volume5mUsd)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <section className="bg-panel border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-white">Opportunity score</h2>
            <div className="flex items-center gap-2">
              <StatusPill status={risk?.criticalDisqualified ? "DISQUALIFIED" : opportunity?.status} />
              <ScoreBadge score={opportunity?.score} kind="opportunity" />
            </div>
          </div>
          {opportunity?.breakdown && (
            <div className="flex flex-col gap-2 text-sm">
              {(opportunity.breakdown as any[]).map((b) => (
                <div key={b.category} className="flex items-center justify-between">
                  <span className="text-gray-400">{b.category}</span>
                  <span className="text-gray-200">
                    {b.awarded.toFixed(1)} / {b.weight}
                  </span>
                </div>
              ))}
            </div>
          )}
          {opportunity?.reasons && (opportunity.reasons as string[]).length > 0 && (
            <div className="mt-4">
              <div className="text-xs uppercase text-gray-500 mb-1">Reasons</div>
              <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                {(opportunity.reasons as string[]).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {opportunity?.warnings && (opportunity.warnings as string[]).length > 0 && (
            <div className="mt-4">
              <div className="text-xs uppercase text-warn mb-1">Warnings</div>
              <ul className="list-disc list-inside text-sm text-warn/90 space-y-1">
                {(opportunity.warnings as string[]).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="bg-panel border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-white">Risk assessment</h2>
            <ScoreBadge score={risk?.riskScore} kind="risk" />
          </div>
          {holders && (
            <div className="text-sm text-gray-400 mb-3">
              Top 10 holders own {holders.top10HolderPct?.toFixed(1) ?? "—"}% of supply.
            </div>
          )}
          <div className="flex flex-col gap-2">
            {((risk?.flags as any[]) ?? []).map((f, i) => (
              <div
                key={i}
                className={`text-sm px-3 py-2 rounded ${
                  f.severity === "critical" ? "bg-danger/10 text-danger" : f.severity === "warning" ? "bg-warn/10 text-warn" : "bg-white/5 text-gray-400"
                }`}
              >
                {f.message}
              </div>
            ))}
            {(!risk?.flags || (risk.flags as any[]).length === 0) && (
              <div className="text-sm text-gray-500">No risk flags triggered.</div>
            )}
          </div>
        </section>
      </div>

      <section className="bg-panel border border-border rounded-lg p-4 mb-6">
        <h2 className="font-semibold text-white mb-3">Smart-money clusters</h2>
        <div className="flex flex-col gap-3">
          {(token.clusters ?? []).map((c: any) => (
            <div key={c.id} className="border border-border/60 rounded p-3">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-white font-medium">
                  {c.memberCount} traders in {c.windowSeconds}s
                </span>
                <ScoreBadge score={c.clusterScore} kind="opportunity" />
              </div>
              <div className="text-xs text-gray-400">
                Avg trader score {c.avgTraderScore.toFixed(0)} · Still holding {c.stillHoldingCount} · Exited {c.exitingCount} · Price since first entry{" "}
                {fmtPct(c.priceChangeSincePct)}
              </div>
            </div>
          ))}
          {(!token.clusters || token.clusters.length === 0) && <div className="text-sm text-gray-500">No clusters detected for this token.</div>}
        </div>
      </section>

      <section className="bg-panel border border-border rounded-lg p-4">
        <h2 className="font-semibold text-white mb-3">Recent trades</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-border">
              <th className="p-2">Wallet</th>
              <th className="p-2">Trader score</th>
              <th className="p-2">Side</th>
              <th className="p-2">Value</th>
              <th className="p-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {(token.trades ?? []).slice(0, 30).map((t: any) => (
              <tr key={t.id} className="border-b border-border/40">
                <td className="p-2 text-gray-300">{t.wallet.fomoUsername ?? `${t.wallet.address.slice(0, 6)}…`}</td>
                <td className="p-2">
                  <ScoreBadge score={t.wallet.traderScore} kind="opportunity" />
                </td>
                <td className={`p-2 ${t.side === "BUY" ? "text-accent" : "text-danger"}`}>{t.side}</td>
                <td className="p-2 text-gray-300">{fmtUsd(t.valueUsd)}</td>
                <td className="p-2 text-gray-500">{new Date(t.occurredAt).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
