import Link from "next/link";
import { api, safeFetch } from "@/lib/api";
import { ErrorNote, PageHeader, ScoreBadge, StatCard, StatusPill } from "@/components/UiBits";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const { data: overview, error } = await safeFetch(() => api.marketOverview());
  const { data: alerts } = await safeFetch(() => api.alerts(8));

  return (
    <div>
      <PageHeader title="Overview" sub="Live market activity across every token Meme Jarvis is tracking." />
      <ErrorNote error={error} />

      {overview && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Tokens tracked" value={overview.tokenCount} />
            <StatCard label="Alerts (last hour)" value={overview.alertsLastHour} />
            <StatCard label="Open paper positions" value={overview.openPaperPositions} />
            <StatCard label="Recent clusters" value={overview.recentClusters?.length ?? 0} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-panel border border-border rounded-lg p-4">
              <h2 className="font-semibold text-white mb-3">Top 10 opportunities</h2>
              <div className="flex flex-col gap-2">
                {(overview.topOpportunities ?? []).map((t: any) => (
                  <Link
                    key={t.mint}
                    href={`/tokens/${t.mint}`}
                    className="flex items-center justify-between px-3 py-2 rounded hover:bg-white/5"
                  >
                    <span className="text-sm text-gray-200">{t.symbol ?? t.mint.slice(0, 6)}</span>
                    <div className="flex items-center gap-2">
                      <StatusPill status={t.status} />
                      <ScoreBadge score={t.score} kind="opportunity" />
                    </div>
                  </Link>
                ))}
                {(!overview.topOpportunities || overview.topOpportunities.length === 0) && (
                  <div className="text-sm text-gray-500">No opportunities scored yet — waiting on live data.</div>
                )}
              </div>
            </section>

            <section className="bg-panel border border-border rounded-lg p-4">
              <h2 className="font-semibold text-white mb-3">Recent smart-money clusters</h2>
              <div className="flex flex-col gap-2">
                {(overview.recentClusters ?? []).map((c: any) => (
                  <Link
                    key={c.id}
                    href={`/tokens/${c.token?.mintAddress}`}
                    className="flex items-center justify-between px-3 py-2 rounded hover:bg-white/5"
                  >
                    <span className="text-sm text-gray-200">{c.token?.symbol ?? c.token?.mintAddress?.slice(0, 6)}</span>
                    <span className="text-xs text-gray-400">{c.memberCount} traders / {c.windowSeconds}s</span>
                    <ScoreBadge score={c.clusterScore} kind="opportunity" />
                  </Link>
                ))}
                {(!overview.recentClusters || overview.recentClusters.length === 0) && (
                  <div className="text-sm text-gray-500">No clusters detected yet.</div>
                )}
              </div>
            </section>
          </div>
        </>
      )}

      <section className="bg-panel border border-border rounded-lg p-4 mt-6">
        <h2 className="font-semibold text-white mb-3">Recent alerts</h2>
        <div className="flex flex-col gap-2">
          {(alerts ?? []).map((a: any) => (
            <div key={a.id} className="text-sm text-gray-300 border-b border-border/50 pb-2 last:border-0">
              <span className="text-gray-500 mr-2">{new Date(a.createdAt).toLocaleTimeString()}</span>
              <span className="font-medium text-white mr-2">{a.category.replace(/_/g, " ")}</span>
              {a.token?.symbol && <span className="text-gray-400">({a.token.symbol})</span>}
            </div>
          ))}
          {(!alerts || alerts.length === 0) && <div className="text-sm text-gray-500">No alerts yet.</div>}
        </div>
        <div className="mt-2">
          <Link href="/alerts" className="text-xs text-accent hover:underline">
            View all alerts →
          </Link>
        </div>
      </section>
    </div>
  );
}
