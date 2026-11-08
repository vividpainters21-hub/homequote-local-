import Link from 'next/link';
import type { ReactNode } from 'react';

export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="dashboard">
      <aside className="side">
        <div className="brand">HomeQuote <span>Local</span></div>
        <hr />
        <p><Link href="/admin">Active jobs</Link></p>
        <p><Link href="/admin?status=new">New requests</Link></p>
        <p><Link href="/admin?status=completed">Completed</Link></p>
        <p><Link href="/request">Request form</Link></p>
        <form action="/auth/signout" method="post"><button className="link-button">Sign out</button></form>
      </aside>
      <main className="main"><div className="mobile-admin-nav"><Link href="/admin">← Jobs</Link></div><h1>{title}</h1>{children}</main>
    </div>
  );
}
