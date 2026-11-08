'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { JOB_STATUSES, STATUS_LABEL, centsToMoney, type JobMessage, type JobStatus } from '@/lib/jobs';
import { METHOD_LABEL, summarizePayments, type PaymentRow } from '@/lib/payments';

interface EditorJob {
  id: string;
  status: JobStatus;
  quoteCents: number | null;
  quoteDetails: string;
  quoteSentAt: string | null;
  approvedAt: string | null;
  approvedSignature: string | null;
  scheduledFor: string | null;
  internalNotes: string;
  suggestedQuote: number | null;
  suggestedDetails: string;
  depositPercent: number;
  balanceRequestedAt: string | null;
}

type Notified = { email: boolean; sms: boolean } | null;
const describe = (n: Notified) => (!n ? '' : n.email || n.sms ? ` Customer notified by ${[n.email && 'email', n.sms && 'text'].filter(Boolean).join(' and ')}.` : ' No email/text is set up, so send them the link yourself.');

export function JobEditor({ job, messages, customerLink, payments, stripeReady }: { job: EditorJob; messages: JobMessage[]; customerLink: string; payments: PaymentRow[]; stripeReady: boolean }) {
  const router = useRouter();
  const [quote, setQuote] = useState(job.quoteCents != null ? String(job.quoteCents / 100) : job.suggestedQuote != null ? String(job.suggestedQuote) : '');
  const [details, setDetails] = useState(job.quoteDetails || job.suggestedDetails);
  const [status, setStatus] = useState<JobStatus>(job.status);
  const [date, setDate] = useState(job.scheduledFor ?? '');
  const [notes, setNotes] = useState(job.internalNotes);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const locked = Boolean(job.approvedAt);
  const [deposit, setDeposit] = useState(String(job.depositPercent));
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('check');
  const [payKind, setPayKind] = useState('deposit');
  const [payNote, setPayNote] = useState('');
  const pay = summarizePayments(job.quoteCents, job.depositPercent, payments);

  async function call(label: string, url: string, method: string, body: Record<string, unknown>, success: string) {
    setBusy(label); setMsg(null);
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Request failed.');
      setMsg({ ok: true, text: success + describe(data.notified ?? null) });
      router.refresh();
      return true;
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Request failed.' });
      return false;
    } finally {
      setBusy('');
    }
  }

  const patch = (label: string, body: Record<string, unknown>, success: string) => call(label, `/api/admin/jobs/${job.id}`, 'PATCH', body, success);
  const quoteNumber = quote.trim() === '' ? null : Number(quote);

  return (
    <aside className="job-side">
      {msg && <p className={msg.ok ? 'success-banner' : 'error'}>{msg.text}</p>}

      <section className="card">
        <span className="eyebrow">Quote</span>
        {locked ? (
          <>
            <div className="quote-amount">{centsToMoney(job.quoteCents)}</div>
            <div className="success-banner">Approved by {job.approvedSignature} on {new Date(job.approvedAt!).toLocaleDateString()}</div>
            <p className="pre muted">{job.quoteDetails}</p>
          </>
        ) : (
          <>
            <label>Price ($)<input type="number" min="0" step="1" value={quote} onChange={(e) => setQuote(e.target.value)} /></label>
            <label>Deposit due after approval (%)<input type="number" min="0" max="100" step="5" value={deposit} onChange={(e) => setDeposit(e.target.value)} /></label>
            <label>What's included (the customer sees this)<textarea value={details} onChange={(e) => setDetails(e.target.value)} /></label>
            {job.quoteSentAt && <p className="muted">Sent {new Date(job.quoteSentAt).toLocaleString()}. Re-send to notify them of changes.</p>}
            <div className="inline-actions">
              <button className="btn" disabled={!!busy || quoteNumber == null || Number.isNaN(quoteNumber)} onClick={() => patch('send', { quoteDollars: quoteNumber, quoteDetails: details, depositPercent: Number(deposit) || 0, sendQuote: true }, 'Quote sent.')}>
                {busy === 'send' ? 'Sending…' : job.quoteSentAt ? 'Update & re-send quote' : 'Send quote'}
              </button>
              <button className="btn secondary" disabled={!!busy} onClick={() => patch('draft', { quoteDollars: quoteNumber, quoteDetails: details, depositPercent: Number(deposit) || 0 }, 'Draft saved.')}>Save draft</button>
            </div>
          </>
        )}
      </section>

      {locked && (
        <section className="card">
          <span className="eyebrow">Payments</span>
          <div className="est-row">
            <div><small>Paid</small><b>{centsToMoney(pay.paid)}</b></div>
            <div><small>Remaining</small><b>{centsToMoney(pay.remaining)}</b></div>
            <div><small>Deposit ({job.depositPercent}%)</small><b>{pay.depositDue > 0 ? `${centsToMoney(pay.depositDue)} due` : 'Paid'}</b></div>
          </div>
          {payments.length > 0 && <ul className="pay-list">{payments.map((p) => (
            <li key={p.id}>
              <span><b>{centsToMoney(p.amount_cents)}</b> {p.kind} · {METHOD_LABEL[p.method]}<small>{new Date(p.created_at).toLocaleDateString()}{p.note ? ` · ${p.note}` : ''}</small></span>
              {p.method !== 'stripe' && <button className="link-danger" disabled={!!busy} onClick={() => { if (confirm('Remove this payment entry?')) call('del', `/api/admin/jobs/${job.id}/payments`, 'POST', { action: 'delete', paymentId: p.id }, 'Payment removed.'); }}>Remove</button>}
            </li>
          ))}</ul>}
          {pay.remaining > 0 && (
            <>
              <button className="btn" disabled={!!busy} onClick={() => call('balance', `/api/admin/jobs/${job.id}/payments`, 'POST', { action: 'request_balance' }, 'Final payment requested.')}>
                {busy === 'balance' ? 'Sending…' : job.balanceRequestedAt ? `Re-send payment request (${centsToMoney(pay.remaining)})` : `Request final payment (${centsToMoney(pay.remaining)})`}
              </button>
              {!stripeReady && <p className="muted">Online payment is off until you add your Stripe keys. You can still record cash and checks below.</p>}
              <details className="record-pay">
                <summary>Record cash, check or Zelle</summary>
                <label>Amount ($)<input type="number" min="0" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></label>
                <label>Method<select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}><option value="check">Check</option><option value="cash">Cash</option><option value="zelle">Zelle</option><option value="other">Other</option></select></label>
                <label>For<select value={payKind} onChange={(e) => setPayKind(e.target.value)}><option value="deposit">Deposit</option><option value="balance">Final payment</option><option value="other">Other</option></select></label>
                <label>Note (check #, etc.)<input value={payNote} onChange={(e) => setPayNote(e.target.value)} maxLength={500} /></label>
                <button className="btn secondary" disabled={!!busy || !(Number(payAmount) > 0)} onClick={async () => {
                  if (await call('record', `/api/admin/jobs/${job.id}/payments`, 'POST', { action: 'record', amountDollars: Number(payAmount), method: payMethod, kind: payKind, note: payNote }, 'Payment recorded.')) { setPayAmount(''); setPayNote(''); }
                }}>Save payment</button>
              </details>
            </>
          )}
          {pay.remaining === 0 && <div className="success-banner"><b>Paid in full.</b></div>}
        </section>
      )}

      <section className="card">
        <span className="eyebrow">Status &amp; schedule</span>
        <label>Status<select value={status} onChange={(e) => setStatus(e.target.value as JobStatus)}>{JOB_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></label>
        <label>Scheduled start<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <div className="inline-actions">
          <button className="btn" disabled={!!busy} onClick={() => patch('status-notify', { status, scheduledFor: date || null, notifyCustomer: true }, 'Updated.')}>Save &amp; tell customer</button>
          <button className="btn secondary" disabled={!!busy} onClick={() => patch('status', { status, scheduledFor: date || null }, 'Updated.')}>Save quietly</button>
        </div>
      </section>

      <section className="card">
        <span className="eyebrow">Messages</span>
        <div className="thread">
          {messages.length ? messages.map((m) => (
            <div key={m.id} className={`bubble ${m.sender === 'contractor' ? 'customer' : 'contractor'}`}><b>{m.sender === 'contractor' ? 'You' : 'Customer'}</b><p>{m.body}</p><small>{new Date(m.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></div>
          )) : <p className="muted">No messages yet.</p>}
        </div>
        <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to the customer…" maxLength={4000} />
        <button className="btn" disabled={!!busy || !reply.trim()} onClick={async () => { if (await call('reply', `/api/admin/jobs/${job.id}/messages`, 'POST', { body: reply }, 'Message sent.')) setReply(''); }}>{busy === 'reply' ? 'Sending…' : 'Send reply'}</button>
      </section>

      <section className="card">
        <span className="eyebrow">Private notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Only you see these: measurements, paint colors, gate code…" />
        <button className="btn secondary" disabled={!!busy} onClick={() => patch('notes', { internalNotes: notes }, 'Notes saved.')}>Save notes</button>
      </section>

      <section className="card">
        <span className="eyebrow">Customer's private link</span>
        <p className="muted small-break">{customerLink}</p>
        <div className="inline-actions">
          <button className="btn secondary compact" onClick={() => navigator.clipboard.writeText(customerLink).then(() => setMsg({ ok: true, text: 'Link copied.' }))}>Copy link</button>
          <a className="btn secondary compact" href={customerLink} target="_blank" rel="noreferrer">Preview as customer</a>
        </div>
      </section>
    </aside>
  );
}
