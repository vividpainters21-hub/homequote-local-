import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdmin } from '@/lib/auth';
import { notifyCustomer } from '@/lib/notify';

const Schema = z.object({ body: z.string().trim().min(1).max(4000) });

/** Contractor replies to the customer. The customer gets the message by email/text with their link. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: 'Sign in as the contractor account.' }, { status: 401 });
  const { id } = await params;
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Write a message first.' }, { status: 400 });

  const { data: job } = await admin.supabase.from('jobs').select('id, service, customer_email, customer_phone, public_token').eq('id', id).single();
  if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });

  const { data: message, error } = await admin.supabase
    .from('job_messages')
    .insert({ job_id: id, sender: 'contractor', body: parsed.data.body })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const notified = await notifyCustomer(job, `New message about your ${job.service} project`, parsed.data.body.slice(0, 600));
  return NextResponse.json({ message, notified });
}
