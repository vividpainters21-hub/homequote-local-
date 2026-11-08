import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { appUrl, notifyContractor } from '@/lib/notify';
import { rateLimit } from '@/lib/rate-limit';
import { centsToMoney } from '@/lib/jobs';

const ActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('message'), body: z.string().trim().min(1).max(4000) }),
  z.object({ action: z.literal('approve'), signature: z.string().trim().min(2).max(120), agree: z.literal(true), quoteCents: z.number().int().nonnegative() }),
]);

const validToken = (t: string) => /^[a-f0-9]{36}$/.test(t);

/** Customer actions on their own job, authorized by the private link token. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!validToken(token)) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  const limit = rateLimit(request, 'portal', 30, 10 * 60 * 1000);
  if (!limit.ok) return NextResponse.json({ error: 'Too many requests. Please wait a few minutes.' }, { status: 429 });

  const parsed = ActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Please check the form and try again.' }, { status: 400 });

  const db = createAdminClient();
  const { data: job } = await db.from('jobs').select('id, status, customer_name, service, quote_cents').eq('public_token', token).single();
  if (!job) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  const adminLink = `${appUrl()}/admin/jobs/${job.id}`;

  if (parsed.data.action === 'message') {
    const { error } = await db.from('job_messages').insert({ job_id: job.id, sender: 'customer', body: parsed.data.body });
    if (error) return NextResponse.json({ error: 'Message could not be sent.' }, { status: 500 });
    await notifyContractor(`Message from ${job.customer_name}`, `${parsed.data.body.slice(0, 300)}\n${adminLink}`);
    return NextResponse.json({ ok: true });
  }

  // Approve: only a sent quote can be approved, and only once.
  if (job.status !== 'quoted' || job.quote_cents == null) {
    return NextResponse.json({ error: 'There is no quote waiting for approval.' }, { status: 409 });
  }
  // The customer must be approving the exact amount they were shown.
  if (parsed.data.quoteCents !== job.quote_cents) {
    return NextResponse.json({ error: 'This quote was just updated. Please refresh the page to see the latest version.' }, { status: 409 });
  }
  const { data: updated, error } = await db
    .from('jobs')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_signature: parsed.data.signature, approved_ip: limit.ip })
    .eq('id', job.id)
    .eq('status', 'quoted')
    .eq('quote_cents', parsed.data.quoteCents)
    .select('id')
    .maybeSingle();
  if (error || !updated) return NextResponse.json({ error: 'The quote could not be approved. Please refresh and try again.' }, { status: 409 });
  await notifyContractor(`Quote approved: ${job.customer_name}`, `${job.service} for ${centsToMoney(job.quote_cents)}. Signed by ${parsed.data.signature}.\n${adminLink}`);
  return NextResponse.json({ ok: true });
}
