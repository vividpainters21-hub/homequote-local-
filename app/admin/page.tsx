import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/auth';
import { JOB_STATUSES, STATUS_LABEL, centsToMoney, type JobRow, type JobStatus } from '@/lib/jobs';
import { AdminShell } from '@/components/AdminShell';

export const dynamic = 'force-dynamic';

const ACTIVE: JobStatus[] = ['new', 'quoted', 'approved', 'scheduled', 'in_progress'];

export default async function AdminJobs({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login?next=/admin');
  const { status } = await searchParams;
  const filter = JOB_STATUSES.includes(status as JobStatus) ? (status as JobStatus) : null;

  let query = admin.supabase
    .from('jobs')
    .select('id, status, customer_name, customer_phone, customer_email, city, state, service, estimate_low_cents, estimate_high_cents, quote_cents, scheduled_for, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  query = filter ? query.eq('status', filter) : query.in('status', ACTIVE);
  const { data, error } = await query;
  const jobs = (data ?? []) as Pick<JobRow, 'id' | 'status' | 'customer_name' | 'customer_phone' | 'customer_email' | 'city' | 'state' | 'service' | 'estimate_low_cents' | 'estimate_high_cents' | 'quote_cents' | 'scheduled_for' | 'created_at'>[];

  const { data: all } = await admin.supabase.from('jobs').select('status, quote_cents');
  const counts = Object.fromEntries(JOB_STATUSES.map((s) => [s, 0])) as Record<JobStatus, number>;
  let pipeline = 0;
  for (const j of all ?? []) {
    counts[j.status as JobStatus]++;
    if (['approved', 'scheduled', 'in_progress'].includes(j.status)) pipeline += j.quote_cents ?? 0;
  }

  return (
    <AdminShell title="Jobs">
      <div className="grid">
        <div className="card"><div className="muted">New requests to quote</div><div className="metric">{counts.new}</div></div>
        <div className="card"><div className="muted">Quotes waiting on customer</div><div className="metric">{counts.quoted}</div></div>
        <div className="card"><div className="muted">Approved work not yet done</div><div className="metric">{centsToMoney(pipeline)}</div></div>
      </div>

      <nav className="filters" aria-label="Filter jobs">
        <Link className={!filter ? 'active' : ''} href="/admin">Active</Link>
        {JOB_STATUSES.map((s) => <Link key={s} className={filter === s ? 'active' : ''} href={`/admin?status=${s}`}>{STATUS_LABEL[s]} ({counts[s]})</Link>)}
      </nav>

      <section className="card">
        {error && <p className="error">Could not load jobs: {error.message}. Did you run migration 003?</p>}
        {!error && jobs.length === 0 ? (
          <div className="empty-state"><h3>No jobs here</h3><p>New requests from your estimate form show up here, and you get a text when one comes in.</p><Link className="btn" href="/request">Open the request form</Link></div>
        ) : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Customer</th><th>Job</th><th>Status</th><th>Price</th><th></th></tr></thead>
            <tbody>{jobs.map((j) => (
              <tr key={j.id}>
                <td>{j.customer_name}<small>{j.customer_phone || j.customer_email}</small></td>
                <td>{j.service}<small>{j.city}, {j.state} · {new Date(j.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</small></td>
                <td><span className={`status s-${j.status}`}>{STATUS_LABEL[j.status]}</span>{j.scheduled_for && <small>{j.scheduled_for}</small>}</td>
                <td>{j.quote_cents != null ? centsToMoney(j.quote_cents) : <span className="muted">{centsToMoney(j.estimate_low_cents)}–{centsToMoney(j.estimate_high_cents)} est.</span>}</td>
                <td><Link className="btn secondary compact" href={`/admin/jobs/${j.id}`}>Open</Link></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </AdminShell>
  );
}
