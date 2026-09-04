import Link from "next/link";
import { api, safeFetch } from "@/lib/api";
import { ErrorNote, fmtAge, fmtUsd, PageHeader, ScoreBadge, StatusPill } from "@/components/UiBits";

export const dynamic = "force-dynamic";

export default async function TokensPage({ searchParams }: { searchParams: { minScore?: string; maxRisk?: string } }) {
  const { data: tokens, error } = await safeFetch(() =>
    api.tokens({
      minScore: searchParams.minScore ? Number(searchParams.minScore) : undefined,
      maxRisk: searchParams.maxRisk ? Number(searchParams.maxRisk) : undefined,
      limit: 200,
    })
  );

  return (
    <div>
      <PageHeader title="Tokens" sub="Every token Meme Jarvis is tracking, with live scores." />
      <ErrorNote error={error} />

      <form className="flex gap-3 mb-4 text-sm">
        <input
          name="minScore"
          defaultValue={searchParams.minScore}
          placeholder="Min opportunity score"
          className="bg-panel border border-border rounded px-3 py-1.5 text-gray-200 w-52"
        />
        <input
          name="maxRisk"
          defaultValue={searchParams.maxRisk}
          placeholder="Max risk score"
          className="bg-panel border border-border rounded px-3 py-1.5 text-gray-200 w-52"
        />
        <button className="bg-accent/10 text-accent px-3 py-1.5 rounded text-sm">Filter</button>
      </form>

      <div className="bg-panel border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-border">
              <th className="p-3">Symbol</th>
              <th className="p-3">Price</th>
              <th className="p-3">Opportunity</th>
              <th className="p-3">Risk</th>
              <th className="p-3">Status</th>
              <th className="p-3">Liquidity</th>
              <th className="p-3">5m Vol</th>
              <th className="p-3">Buy/Sell</th>
              <th className="p-3">Age</th>
            </tr>
          </thead>
          <tbody>
            {(tokens ?? []).map((t) => (
              <tr key={t.mint} className="border-b border-border/50 hover:bg-white/5">
                <td className="p-3">
                  <Link href={`/tokens/${t.mint}`} className="text-white font-medium hover:underline">
                    {t.symbol ?? t.mint.slice(0, 6)}
                  </Link>
                </td>
                <td className="p-3 text-gray-300">{fmtUsd(t.priceUsd)}</td>
                <td className="p-3">
                  <ScoreBadge score={t.opportunityScore} kind="opportunity" />
                </td>
                <td className="p-3">
                  <ScoreBadge score={t.riskScore} kind="risk" />
                </td>
                <td className="p-3">
                  <StatusPill status={t.criticalDisqualified ? "DISQUALIFIED" : t.status} />
                </td>
                <td className="p-3 text-gray-300">{fmtUsd(t.liquidityUsd)}</td>
                <td className="p-3 text-gray-300">{fmtUsd(t.volume5mUsd)}</td>
                <td className="p-3 text-gray-300">{t.buySellRatio ? `${t.buySellRatio.toFixed(1)}:1` : "—"}</td>
                <td className="p-3 text-gray-400">{fmtAge(t.tokenCreatedAt)}</td>
              </tr>
            ))}
            {(!tokens || tokens.length === 0) && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-gray-500">
                  No tokens tracked yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
