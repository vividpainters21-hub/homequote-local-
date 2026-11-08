import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { PUBLIC_JOB_COLUMNS, STATUS_LABEL, TIMELINE, centsToMoney, fullAddress, toPublicJob, type JobMessage } from '@/lib/jobs';
import { businessName } from '@/lib/notify';
import { PortalActions } from './PortalActions';
import { PAYABLE_STATUSES, summarizePayments } from '@/lib/payments';

export const dynamic = 'force-dynamic';
// The token in the URL is the customer's key: keep the page out of search engines and referrers.
export const metadata: Metadata = { title: 'Your project', robots: { index: false, follow: false }, referrer: 'no-referrer' };

const formatDate = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

export default async function CustomerPortal({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ paid?: string }> }) {
  const { token } = await params;
  const { paid: justPaid } = await searchParams;
  if (!/^[a-f0-9]{36}$/.test(token)) notFound();

  const db = createAdminClient();
  const { data: row } = await db.from('jobs').select(PUBLIC_JOB_COLUMNS).eq('public_token', token).single();
  if (!row) notFound();
  const job = toPublicJob(row as Parameters<typeof toPublicJob>[0]);
  const [{ data: messages }, { data: payments }] = await Promise.all([
    db.from('job_messages').select('id, sender, body, created_at').eq('job_id', job.id).order('created_at'),
    db.from('job_payments').select('amount_cents').eq('job_id', job.id),
  ]);
  const pay = summarizePayments(job.quote_cents, job.deposit_percent, payments ?? []);
  const showPayments = Boolean(job.approved_at) && job.quote_cents != null && PAYABLE_STATUSES.includes(job.status);
  const online = Boolean(process.env.STRIPE_SECRET_KEY);

  const stepIndex = TIMELINE.indexOf(job.status);
  const phone = process.env.NEXT_PUBLIC_BUSINESS_PHONE;

  return (
    <>
      <header className="site-header"><div className="wrap nav"><span className="brand">{businessName()}</span>{phone && <a className="btn secondary compact" href={`tel:${phone}`}>Call {phone}</a>}</div></header>
      <main className="wrap section portal">
        <section className="card">
          <span className="eyebrow">Your project</span>
          <h1 className="portal-title">{job.service}</h1>
          <p className="muted">{fullAddress(job)} · Requested {formatDate(job.created_at)}</p>

          {job.status === 'lost' ? (
            <div className="alert">This project is closed. Send us a message below if you would like to reopen it.</div>
          ) : (
            <ol className="timeline" aria-label="Project progress">
              {TIMELINE.map((s, i) => <li key={s} className={i < stepIndex ? 'done' : i === stepIndex ? 'current' : ''}><span>{i + 1}</span>{STATUS_LABEL[s]}</li>)}
            </ol>
          )}
          {job.scheduled_for && <div className="success-banner"><b>Scheduled:</b> {formatDate(job.scheduled_for)}</div>}
        </section>

        {job.quote_sent_at && job.quote_cents != null ? (
          <section className="card">
            <span className="eyebrow">Your quote</span>
            <div className="quote-amount">{centsToMoney(job.quote_cents)}</div>
            {job.quote_details && <div className="quote-details">{job.quote_details}</div>}
            {job.deposit_percent > 0 && <p className="muted">Payment terms: {job.deposit_percent}% deposit ({centsToMoney(Math.round(job.quote_cents * job.deposit_percent / 100))}) after approval to book your start date, remainder when the work is complete.</p>}
            {job.approved_at ? (
              <div className="success-banner"><b>Approved</b> by {job.approved_signature} on {formatDate(job.approved_at)}. Thank you!</div>
            ) : (
              <PortalActions token={token} mode="approve" quoteCents={job.quote_cents} depositPercent={job.deposit_percent} />
            )}
          </section>
        ) : (
          <section className="card">
            <span className="eyebrow">Preliminary estimate</span>
            <div className="quote-amount">{centsToMoney(job.estimate_low_cents)}–{centsToMoney(job.estimate_high_cents)}</div>
            <p className="muted">This is an automatic starting range, not a quote. We will review your project, may ask a few questions or visit, and then send your final quote here.</p>
            {job.scope.length > 0 && <><h3>Proposed scope</h3><div className="scope-list">{job.scope.map((s, i) => <div key={`${s.title}-${i}`}><span>{i + 1}</span><div><b>{s.title}</b><p>{s.description}</p></div></div>)}</div></>}
            {(job.assumptions.length > 0 || job.exclusions.length > 0) && <div className="result-columns"><div><h3>Assumptions</h3><ul>{job.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></div><div><h3>Not included</h3><ul>{job.exclusions.map((e) => <li key={e}>{e}</li>)}</ul></div></div>}
          </section>
        )}

        {showPayments && (
          <section className="card">
            <span className="eyebrow">Payments</span>
            {justPaid && <div className="success-banner">Thank you! Your payment is being confirmed and will show here shortly.</div>}
            <div className="est-row">
              <div><small>Total</small><b>{centsToMoney(pay.total)}</b></div>
              <div><small>Paid</small><b>{centsToMoney(pay.paid)}</b></div>
              <div><small>Remaining</small><b>{centsToMoney(pay.remaining)}</b></div>
            </div>
            {pay.remaining === 0 ? (
              <div className="success-banner"><b>Paid in full.</b> Thank you!</div>
            ) : pay.depositDue > 0 ? (
              online ? <PortalActions token={token} mode="pay" kind="deposit" amountCents={pay.depositDue} label={`Pay ${job.deposit_percent}% deposit`} />
                : <p className="muted">A {job.deposit_percent}% deposit of {centsToMoney(pay.depositDue)} is due to book your start date. Message us to arrange payment.</p>
            ) : job.balance_requested_at ? (
              online ? <PortalActions token={token} mode="pay" kind="balance" amountCents={pay.remaining} label="Pay remaining balance" />
                : <p className="muted">Your remaining balance of {centsToMoney(pay.remaining)} is due. Message us to arrange payment.</p>
            ) : (
              <p className="muted">Deposit received. The remaining balance is due when the work is complete.</p>
            )}
          </section>
        )}

        <section className="card">
          <span className="eyebrow">Messages</span>
          <div className="thread">
            {(messages as JobMessage[] | null)?.length ? (messages as JobMessage[]).map((m) => (
              <div key={m.id} className={`bubble ${m.sender}`}><b>{m.sender === 'customer' ? 'You' : businessName()}</b><p>{m.body}</p><small>{new Date(m.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></div>
            )) : <p className="muted">No messages yet. Questions about the project? Ask here and we will reply by email or text.</p>}
          </div>
          <PortalActions token={token} mode="message" />
        </section>

        <section className="card">
          <span className="eyebrow">Photos</span>
          <p className="muted">Add photos of the work area to help us quote accurately.</p>
          <PortalActions token={token} mode="photos" />
        </section>

        <p className="fine-print">Keep this link private: anyone with it can view this project and send messages. Bookmark it to come back later.</p>
      </main>
    </>
  );
}
