import { api, safeFetch } from "@/lib/api";
import { ErrorNote, PageHeader } from "@/components/UiBits";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { data: settings, error } = await safeFetch(() => api.paperSettings());

  return (
    <div>
      <PageHeader title="Settings" sub="Paper-trading account limits. Live trading is not implemented in this build — see below." />
      <ErrorNote error={error} />

      {settings && (
        <section className="bg-panel border border-border rounded-lg p-4 mb-6 max-w-2xl">
          <h2 className="font-semibold text-white mb-3">Paper account: {settings.name}</h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-gray-500">Starting balance</dt>
            <dd className="text-gray-200">${settings.startingBalanceUsd.toLocaleString()}</dd>
            <dt className="text-gray-500">Position size</dt>
            <dd className="text-gray-200">${settings.positionSizeUsd.toLocaleString()}</dd>
            <dt className="text-gray-500">Risk per trade</dt>
            <dd className="text-gray-200">{settings.riskPerTradePct}%</dd>
            <dt className="text-gray-500">Max concurrent positions</dt>
            <dd className="text-gray-200">{settings.maxConcurrentPositions}</dd>
            <dt className="text-gray-500">Max daily loss</dt>
            <dd className="text-gray-200">${settings.maxDailyLossUsd.toLocaleString()}</dd>
            <dt className="text-gray-500">Min opportunity score</dt>
            <dd className="text-gray-200">{settings.minOpportunityScore}</dd>
            <dt className="text-gray-500">Max risk score</dt>
            <dd className="text-gray-200">{settings.maxRiskScore}</dd>
            <dt className="text-gray-500">Max slippage assumption</dt>
            <dd className="text-gray-200">{settings.maxSlippagePct}%</dd>
            <dt className="text-gray-500">Fees</dt>
            <dd className="text-gray-200">{settings.feeBps / 100}%</dd>
            <dt className="text-gray-500">Min liquidity</dt>
            <dd className="text-gray-200">${settings.minLiquidityUsd.toLocaleString()}</dd>
            <dt className="text-gray-500">Min strong traders required</dt>
            <dd className="text-gray-200">{settings.minStrongTraders}</dd>
            <dt className="text-gray-500">Max pump before entry</dt>
            <dd className="text-gray-200">{settings.maxPumpBeforeEntryPct}%</dd>
          </dl>
          <p className="text-xs text-gray-500 mt-4">
            These map to the <code>PaperAccount</code> row in Postgres. Edit via <code>PUT /api/paper/settings</code> or directly in the
            database — a settings form isn't wired up in this build yet.
          </p>
        </section>
      )}

      <section className="bg-panel border border-border rounded-lg p-4 max-w-2xl">
        <h2 className="font-semibold text-white mb-3">Live trading</h2>
        <p className="text-sm text-gray-400">
          Live (real-money) trading is <b className="text-danger">not implemented</b> in this codebase. There is no wallet, no private key
          handling, and no execution path that can submit a transaction on your behalf. Every trade you see anywhere in this dashboard is a
          paper (simulated) trade. If real execution is added later, it must use a dedicated, balance-limited trading wallet — never your main
          wallet — with hard-coded max trade size, max daily loss, max consecutive losses, max slippage, minimum liquidity, and a kill switch
          that Claude cannot override.
        </p>
      </section>
    </div>
  );
}
