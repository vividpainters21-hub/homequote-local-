export function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold text-white mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

export function ScoreBadge({ score, kind }: { score: number | null | undefined; kind: "opportunity" | "risk" }) {
  if (score === null || score === undefined) return <span className="text-gray-500 text-xs">—</span>;
  const good = kind === "opportunity" ? score >= 80 : score <= 25;
  const mid = kind === "opportunity" ? score >= 60 : score <= 50;
  const color = good ? "text-accent bg-accent/10" : mid ? "text-warn bg-warn/10" : "text-danger bg-danger/10";
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{score.toFixed(0)}</span>;
}

export function StatusPill({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const map: Record<string, string> = {
    HIGH_QUALITY_SETUP: "text-accent bg-accent/10",
    WATCH: "text-warn bg-warn/10",
    WEAK: "text-gray-400 bg-white/5",
    DISQUALIFIED: "text-danger bg-danger/10",
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? "text-gray-400 bg-white/5"}`}>{status.replace(/_/g, " ")}</span>;
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="bg-danger/10 border border-danger/30 text-danger text-sm rounded-md p-3 mb-4">
      Could not reach the Meme Jarvis API ({process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}): {error}
      <div className="text-gray-400 mt-1">Make sure `pnpm dev:api` is running (see the root README).</div>
    </div>
  );
}

export function PageHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold text-white">{title}</h1>
      {sub && <p className="text-sm text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export function fmtUsd(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(value < 1 ? 6 : 2)}`;
}

export function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function fmtAge(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const ms = Date.now() - new Date(dateStr).getTime();
  const min = ms / 60000;
  if (min < 60) return `${Math.round(min)}m`;
  if (min < 1440) return `${Math.round(min / 60)}h`;
  return `${Math.round(min / 1440)}d`;
}
