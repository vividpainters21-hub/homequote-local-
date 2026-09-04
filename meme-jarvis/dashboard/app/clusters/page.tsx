import Link from "next/link";
import { api, safeFetch } from "@/lib/api";
import { ErrorNote, fmtPct, PageHeader, ScoreBadge } from "@/components/UiBits";

export const dynamic = "force-dynamic";

export default async function ClustersPage() {
  const { data: clusters, error } = await safeFetch(() => api.clusters(100));

  return (
    <div>
      <PageHeader title="Clusters" sub="Moments where multiple strong traders bought the same token within a short window." />
      <ErrorNote error={error} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(clusters ?? []).map((c: any) => (
          <Link
            key={c.id}
            href={`/tokens/${c.token.mintAddress}`}
            className="bg-panel border border-border rounded-lg p-4 hover:border-accent/50 transition"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-white">{c.token.symbol ?? c.token.mintAddress.slice(0, 6)}</span>
              <ScoreBadge score={c.clusterScore} kind="opportunity" />
            </div>
            <div className="text-sm text-gray-400">
              {c.memberCount} traders within {c.windowSeconds}s · avg score {c.avgTraderScore.toFixed(0)}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Holding {c.stillHoldingCount} · Exited {c.exitingCount} · Price since entry {fmtPct(c.priceChangeSincePct)}
            </div>
            <div className="text-xs text-gray-600 mt-2">{new Date(c.createdAt).toLocaleString()}</div>
          </Link>
        ))}
        {(!clusters || clusters.length === 0) && <div className="text-gray-500 col-span-2">No clusters detected yet.</div>}
      </div>
    </div>
  );
}
