import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdmin } from '@/lib/auth';
import { JOB_STATUSES, centsToMoney, type JobRow } from '@/lib/jobs';
import { notifyCustomer } from '@/lib/notify';

const PatchSchema = z.object({
  status: z.enum(JOB_STATUSES).optional(),
  quoteDollars: z.number().nonnegative().max(10_000_000).nullable().optional(),
  quoteDetails: z.string().max(10_000).optional(),
  scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  internalNotes: z.string().max(10_000).optional(),
  depositPercent: z.number().int().min(0).max(100).optional(),
  /** Marks the quote as sent and emails/texts the customer their link. */
  sendQuote: z.boolean().optional(),
  /** Tell the customer about a status or schedule change. */
  notifyCustomer: z.boolean().optional(),
});

/** Contractor updates a job: quote, schedule, status, notes. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'Sign in as the contractor account.' }, { status: 401 });
  const { id } = await params;

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid update.' }, { status: 400 });
  const p = parsed.data;

  const { data: current } = await admin.supabase.from('jobs').select('*').eq('id', id).single<JobRow>();
  if (!current) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });

  const changes: Partial<JobRow> = {};
  if (p.quoteDollars !== undefined) changes.quote_cents = p.quoteDollars == null ? null : Math.round(p.quoteDollars * 100);
  if (p.quoteDetails !== undefined) changes.quote_details = p.quoteDetails;
  if (p.scheduledFor !== undefined) changes.scheduled_for = p.scheduledFor;
  if (p.internalNotes !== undefined) changes.internal_notes = p.internalNotes;
  if (p.status) changes.status = p.status;
  if (p.depositPercent !== undefined) changes.deposit_percent = p.depositPercent;

  const quoteChanged = changes.quote_cents !== undefined && changes.quote_cents !== current.quote_cents;
  const depositChanged = changes.deposit_percent !== undefined && changes.deposit_percent !== current.deposit_percent;
  if (current.approved_at && depositChanged) {
    return NextResponse.json({ error: 'The deposit terms were part of the approved quote and cannot change now.' }, { status: 409 });
  }
  if (current.approved_at && quoteChanged) {
    return NextResponse.json({ error: 'This quote was already approved. Create a change order in the notes and message the customer instead.' }, { status: 409 });
  }

  if (p.sendQuote) {
    const quote = changes.quote_cents ?? current.quote_cents;
    if (quote == null) return NextResponse.json({ error: 'Enter a quote amount before sending.' }, { status: 400 });
    changes.status = 'quoted';
    changes.quote_sent_at = new Date().toISOString();
  }

  const { data: job, error } = await admin.supabase.from('jobs').update(changes).eq('id', id).select('*').single<JobRow>();
  if (error || !job) return NextResponse.json({ error: error?.message ?? 'Update failed.' }, { status: 400 });

  let notified: { email: boolean; sms: boolean } | null = null;
  if (p.sendQuote) {
    notified = await notifyCustomer(job, `Your ${job.service} quote is ready`, `Your quote for ${job.service} is ready: ${centsToMoney(job.quote_cents)}. You can review and approve it online.`);
  } else if (p.notifyCustomer) {
    const when = job.scheduled_for ? ` Scheduled for ${new Date(job.scheduled_for + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.` : '';
    const label: Record<string, string> = { scheduled: 'Your project is scheduled.', in_progress: 'Work on your project has started.', completed: 'Your project is complete. Thank you!' };
    notified = await notifyCustomer(job, `Update on your ${job.service} project`, `${label[job.status] ?? 'There is an update on your project.'}${when}`);
  }
  return NextResponse.json({ job, notified });
}
