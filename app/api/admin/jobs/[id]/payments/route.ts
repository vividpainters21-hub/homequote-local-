import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdmin } from '@/lib/auth';
import { notifyCustomer } from '@/lib/notify';
import { centsToMoney } from '@/lib/jobs';
import { summarizePayments } from '@/lib/payments';
import { stripeConfigured } from '@/lib/stripe';

const Schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('record'),
    amountDollars: z.number().positive().max(10_000_000),
    method: z.enum(['cash', 'check', 'zelle', 'other']),
    kind: z.enum(['deposit', 'balance', 'other']),
    note: z.string().max(500).default(''),
  }),
  z.object({ action: z.literal('request_balance') }),
  z.object({ action: z.literal('delete'), paymentId: z.string().uuid() }),
]);

/** Contractor: record cash/check payments, remove a mistaken entry, or ask the customer for the final payment. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'Sign in as the contractor account.' }, { status: 401 });
  const { id } = await params;
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Check the payment details.' }, { status: 400 });
  const p = parsed.data;

  const { data: job } = await admin.supabase
    .from('jobs')
    .select('id, service, quote_cents, deposit_percent, approved_at, customer_email, customer_phone, public_token')
    .eq('id', id)
    .single();
  if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });

  if (p.action === 'record') {
    const { error } = await admin.supabase.from('job_payments').insert({
      job_id: id, kind: p.kind, method: p.method, amount_cents: Math.round(p.amountDollars * 100), note: p.note,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (p.action === 'delete') {
    // Online (Stripe) payments can't be deleted here: refund them in the Stripe dashboard.
    const { error } = await admin.supabase.from('job_payments').delete().eq('id', p.paymentId).eq('job_id', id).neq('method', 'stripe');
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  // request_balance
  if (!job.approved_at || job.quote_cents == null) return NextResponse.json({ error: 'The quote must be approved first.' }, { status: 409 });
  const { data: payments } = await admin.supabase.from('job_payments').select('amount_cents').eq('job_id', id);
  const s = summarizePayments(job.quote_cents, job.deposit_percent, payments ?? []);
  if (s.remaining <= 0) return NextResponse.json({ error: 'This job is fully paid.' }, { status: 409 });

  const { error } = await admin.supabase.from('jobs').update({ balance_requested_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const how = stripeConfigured() ? 'You can pay online from your project page.' : 'Reply to this message to arrange payment.';
  const notified = await notifyCustomer(job, `Final payment for your ${job.service} project`, `Your remaining balance is ${centsToMoney(s.remaining)}. ${how}`);
  return NextResponse.json({ ok: true, notified });
}
