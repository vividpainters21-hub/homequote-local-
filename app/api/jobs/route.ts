import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { estimateJob } from '@/lib/ai-estimate';
import { JobRequestSchema, centsToMoney, fullAddress } from '@/lib/jobs';
import { appUrl, notifyContractor } from '@/lib/notify';
import { rateLimit } from '@/lib/rate-limit';

/** Public: a customer submits a project. Returns their private project link token. */
export async function POST(request: Request) {
  const limit = rateLimit(request, 'jobs', 5, 10 * 60 * 1000);
  if (!limit.ok) return NextResponse.json({ error: 'Too many requests. Please wait a few minutes and try again.' }, { status: 429 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'We could not read the request.' }, { status: 400 });
  }
  // Honeypot: a hidden field real visitors never fill in.
  if (typeof body.website === 'string' && body.website) return NextResponse.json({ error: 'Request rejected.' }, { status: 400 });

  const parsed = JobRequestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: `Please check ${String(first?.path[0] ?? 'the form')}: ${first?.message ?? 'invalid value'}.` }, { status: 400 });
  }
  const input = parsed.data;
  const { estimate, source } = await estimateJob(input);

  try {
    const db = createAdminClient();
    const { data: job, error } = await db
      .from('jobs')
      .insert({
        customer_name: input.name,
        customer_email: input.email,
        customer_phone: input.phone,
        address: input.address,
        city: input.city,
        state: input.state,
        zip: input.postalCode,
        service: input.service,
        description: input.description,
        answers: {
          squareFeet: input.squareFeet, linearFeet: input.linearFeet, rooms: input.rooms,
          condition: input.condition, materialsBy: input.materialsBy, timeline: input.timeline, estimateSource: source,
        },
        ai_estimate: estimate,
        estimate_low_cents: Math.round(estimate.customerPriceLow * 100),
        estimate_high_cents: Math.round(estimate.customerPriceHigh * 100),
      })
      .select('id, public_token')
      .single();
    if (error) throw error;

    await notifyContractor(
      `New lead: ${input.service} — ${input.name}`,
      `${fullAddress({ address: input.address, city: input.city, state: input.state, zip: input.postalCode })}\n` +
        `Estimate ${centsToMoney(Math.round(estimate.customerPriceLow * 100))}–${centsToMoney(Math.round(estimate.customerPriceHigh * 100))}\n` +
        `${input.phone || input.email}\n${appUrl()}/admin/jobs/${job.id}`,
    );

    return NextResponse.json({ token: job.public_token }, { status: 201 });
  } catch (error) {
    console.error('[jobs] Could not save job', error);
    return NextResponse.json({ error: 'We could not save your request. Please try again, or call us directly.' }, { status: 500 });
  }
}
