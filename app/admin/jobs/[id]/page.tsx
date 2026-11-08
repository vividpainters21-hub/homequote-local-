import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { STATUS_LABEL, centsToMoney, fullAddress, type JobMessage, type JobRow } from '@/lib/jobs';
import { customerLink } from '@/lib/notify';
import type { Estimate } from '@/lib/estimate';
import { AdminShell } from '@/components/AdminShell';
import { JobEditor } from './JobEditor';

export const dynamic = 'force-dynamic';

export default async function AdminJob({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  const { id } = await params;
  if (!admin) redirect(`/login?next=/admin/jobs/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const { data: job } = await admin.supabase.from('jobs').select('*').eq('id', id).single<JobRow>();
  if (!job) notFound();
  const [{ data: messages }, { data: photoRows }] = await Promise.all([
    admin.supabase.from('job_messages').select('*').eq('job_id', id).order('created_at'),
    admin.supabase.from('job_photos').select('storage_path, original_name, content_type').eq('job_id', id).order('created_at'),
  ]);

  // Short-lived links to view the customer's private photos.
  let photos: { name: string; url: string; isImage: boolean }[] = [];
  if (photoRows?.length) {
    const { data: signed } = await createAdminClient().storage.from('job-photos').createSignedUrls(photoRows.map((p) => p.storage_path), 3600);
    photos = (signed ?? []).flatMap((s, i) => (s.signedUrl && !s.error ? [{ name: photoRows[i].original_name, url: s.signedUrl, isImage: (photoRows[i].content_type ?? '').startsWith('image/') }] : []));
  }

  const est = job.ai_estimate as Estimate | null;
  const answers = job.answers as Record<string, string | number | undefined>;

  return (
    <AdminShell title={`${job.service} — ${job.customer_name}`}>
      <p><Link href="/admin">← All jobs</Link></p>
      <div className="job-layout">
        <div className="job-main">
          <section className="card">
            <span className={`status s-${job.status}`}>{STATUS_LABEL[job.status]}</span>
            <h2>{job.customer_name}</h2>
            <p>
              {job.customer_phone && <><a href={`tel:${job.customer_phone}`}>{job.customer_phone}</a> · <a href={`sms:${job.customer_phone}`}>Text</a> · </>}
              <a href={`mailto:${job.customer_email}`}>{job.customer_email}</a>
            </p>
            <p><a href={`https://maps.google.com/?q=${encodeURIComponent(fullAddress(job))}`} target="_blank" rel="noreferrer">{fullAddress(job)}</a></p>
            <h3>What they asked for</h3>
            <p className="pre">{job.description}</p>
            <p className="muted">
              {[answers.squareFeet && `${answers.squareFeet} sq ft`, answers.linearFeet && `${answers.linearFeet} linear ft`, answers.rooms && `${answers.rooms} rooms`, answers.condition, answers.materialsBy, answers.timeline].filter(Boolean).join(' · ')}
            </p>
            {photos.length > 0 && <div className="photo-grid">{photos.map((p) => <a key={p.url} href={p.url} target="_blank" rel="noreferrer"><figure>{p.isImage ? <img src={p.url} alt={p.name} /> : <div className="file-tile">PDF</div>}<figcaption>{p.name}</figcaption></figure></a>)}</div>}
          </section>

          {est && (
            <section className="card">
              <span className="eyebrow">{answers.estimateSource === 'ai' ? 'AI estimate' : 'Calculator estimate'} · {est.confidence}% confidence</span>
              <div className="est-row">
                <div><small>Customer price</small><b>{centsToMoney(est.customerPriceLow * 100)}–{centsToMoney(est.customerPriceHigh * 100)}</b></div>
                <div><small>Crew labor</small><b>{centsToMoney(est.contractorPayoutLow * 100)}–{centsToMoney(est.contractorPayoutHigh * 100)}</b></div>
                <div><small>Duration</small><b>{est.durationDaysLow}–{est.durationDaysHigh} days</b></div>
              </div>
              <div className="table-wrap"><table className="table"><thead><tr><th>Line item</th><th>Qty</th><th>Labor</th><th>Materials</th></tr></thead><tbody>
                {est.scope.map((s, i) => <tr key={i}><td>{s.title}<small>{s.description}</small></td><td>{s.quantity} {s.unit}</td><td>{centsToMoney(s.laborLow * 100)}–{centsToMoney(s.laborHigh * 100)}</td><td>{centsToMoney(s.materialsLow * 100)}–{centsToMoney(s.materialsHigh * 100)}</td></tr>)}
              </tbody></table></div>
              {est.riskFlags.length > 0 && <div className="alert"><b>Watch for:</b> {est.riskFlags.join(' · ')}</div>}
              {est.followUpQuestions.length > 0 && <><h3>Ask the customer</h3><ul>{est.followUpQuestions.map((q) => <li key={q}>{q}</li>)}</ul></>}
            </section>
          )}
        </div>

        <JobEditor
          job={{
            id: job.id, status: job.status, quoteCents: job.quote_cents, quoteDetails: job.quote_details, quoteSentAt: job.quote_sent_at,
            approvedAt: job.approved_at, approvedSignature: job.approved_signature, scheduledFor: job.scheduled_for, internalNotes: job.internal_notes,
            suggestedQuote: est ? Math.round((est.customerPriceLow + est.customerPriceHigh) / 2) : null,
            suggestedDetails: est ? est.scope.map((s) => `• ${s.title}: ${s.description}`).join('\n') + (est.exclusions.length ? `\n\nNot included: ${est.exclusions.join('; ')}` : '') : '',
          }}
          messages={(messages ?? []) as JobMessage[]}
          customerLink={customerLink(job.public_token)}
        />
      </div>
    </AdminShell>
  );
}
