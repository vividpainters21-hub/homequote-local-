import Link from 'next/link';
import type { ReactNode } from 'react';

export function DashboardShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="dashboard">
      <aside className="side">
        <div className="brand">VividPro <span>Painters</span></div>
        <hr />
        <p><Link href="/dashboard">Homeowner</Link></p>
        <p><Link href="/contractor">Contractor</Link></p>
        <p><Link href="/admin">Administrator</Link></p>
        <p><Link href="/request">New estimate</Link></p>
      </aside>
      <main className="main"><h1>{title}</h1>{children}</main>
    </div>
  );
}
