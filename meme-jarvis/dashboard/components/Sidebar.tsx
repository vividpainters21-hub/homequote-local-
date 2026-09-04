import Link from "next/link";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/smart-money", label: "Smart Money" },
  { href: "/live-feed", label: "Live Fomo Feed" },
  { href: "/tokens", label: "Tokens" },
  { href: "/clusters", label: "Clusters" },
  { href: "/alerts", label: "Alerts" },
  { href: "/paper-trading", label: "Paper Trading" },
  { href: "/performance", label: "Performance" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-border bg-panel min-h-screen p-4">
      <div className="text-lg font-bold mb-1 text-white">Meme Jarvis</div>
      <div className="text-xs text-gray-500 mb-6">paper-trading only — no live execution</div>
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-2 rounded-md text-sm text-gray-300 hover:bg-white/5 hover:text-white transition"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
