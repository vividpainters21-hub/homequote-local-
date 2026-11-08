import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';
import { appUrl, notifyContractor } from '@/lib/notify';
import { centsToMoney } from '@/lib/jobs';

/**
 * Stripe tells us here when a payment succeeds. This is the only place online payments
 * are recorded: the customer's browser landing on the success page proves nothing.
 * Stripe dashboard → Developers → Webhooks → endpoint https://YOUR-SITE/api/stripe/webhook
 * with events: checkout.session.completed, checkout.session.async_payment_succeeded
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get('stripe-signature');
  if (!secret || !signature) return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(await request.text(), signature, secret);
  } catch (error) {
    console.error('[stripe-webhook] Bad signature', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') {
    return NextResponse.json({ received: true });
  }
  const session = event.data.object as Stripe.Checkout.Session;
  // Bank transfers complete later: wait for async_payment_succeeded before recording them.
  if (session.payment_status !== 'paid') return NextResponse.json({ received: true });

  const jobId = session.metadata?.job_id;
  const kind = session.metadata?.kind === 'balance' ? 'balance' : 'deposit';
  if (!jobId || !session.amount_total) return NextResponse.json({ received: true });

  const db = createAdminClient();
  const { error } = await db.from('job_payments').insert({
    job_id: jobId,
    kind,
    method: 'stripe',
    amount_cents: session.amount_total,
    stripe_session_id: session.id,
    stripe_payment_intent: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null,
  });
  if (error) {
    if (error.code === '23505') return NextResponse.json({ received: true, duplicate: true }); // already recorded
    console.error('[stripe-webhook] Could not record payment', error);
    return NextResponse.json({ error: 'Could not record payment' }, { status: 500 }); // Stripe will retry
  }

  const { data: job } = await db.from('jobs').select('customer_name, service').eq('id', jobId).single();
  await notifyContractor(
    `Payment received: ${centsToMoney(session.amount_total)}`,
    `${job?.customer_name ?? 'Customer'} paid the ${kind === 'deposit' ? 'deposit' : 'final payment'} for ${job?.service ?? 'their job'}.\n${appUrl()}/admin/jobs/${jobId}`,
  );
  return NextResponse.json({ received: true });
}
