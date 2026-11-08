import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe, stripeConfigured } from '@/lib/stripe';
import { MIN_CHARGE_CENTS, PAYABLE_STATUSES, summarizePayments } from '@/lib/payments';
import { businessName, customerLink } from '@/lib/notify';
import { rateLimit } from '@/lib/rate-limit';

const Schema = z.object({ kind: z.enum(['deposit', 'balance']) });

/**
 * Starts a Stripe Checkout payment for the customer's deposit or remaining balance.
 * The amount always comes from the approved quote on the server, never from the browser.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{36}$/.test(token)) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  if (!rateLimit(request, 'checkout', 10, 10 * 60 * 1000).ok) return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 });
  if (!stripeConfigured()) return NextResponse.json({ error: 'Online payment is not set up yet. Please contact us to pay.' }, { status: 503 });

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payment request.' }, { status: 400 });
  const { kind } = parsed.data;

  const db = createAdminClient();
  const { data: job } = await db
    .from('jobs')
    .select('id, status, service, customer_email, quote_cents, approved_at, deposit_percent, balance_requested_at, public_token')
    .eq('public_token', token)
    .single();
  if (!job) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  if (!job.approved_at || job.quote_cents == null || !PAYABLE_STATUSES.includes(job.status)) {
    return NextResponse.json({ error: 'Payment opens once your quote is approved.' }, { status: 409 });
  }

  const { data: payments } = await db.from('job_payments').select('amount_cents').eq('job_id', job.id);
  const s = summarizePayments(job.quote_cents, job.deposit_percent, payments ?? []);
  const amount = kind === 'deposit' ? s.depositDue : s.remaining;
  if (kind === 'balance' && !job.balance_requested_at) return NextResponse.json({ error: 'The final payment has not been requested yet.' }, { status: 409 });
  if (amount < MIN_CHARGE_CENTS) return NextResponse.json({ error: kind === 'deposit' ? 'Your deposit is already paid. Thank you!' : 'Nothing is owed. Thank you!' }, { status: 409 });

  const link = customerLink(job.public_token);
  try {
    const session = await getStripe().checkout.sessions.create(
      {
        mode: 'payment',
        customer_email: job.customer_email,
        client_reference_id: job.id,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amount,
            product_data: { name: `${job.service} — ${kind === 'deposit' ? 'deposit' : 'final payment'}`, description: businessName() },
          },
        }],
        metadata: { job_id: job.id, kind },
        payment_intent_data: { metadata: { job_id: job.id, kind }, description: `${businessName()}: ${job.service} ${kind}` },
        success_url: `${link}?paid=1`,
        cancel_url: link,
      },
      // Same job + kind + amount + paid-so-far reuses one session instead of creating duplicates on double-clicks.
      { idempotencyKey: `checkout-${job.id}-${kind}-${amount}-${s.paid}` },
    );
    if (!session.url) throw new Error('Stripe returned no checkout URL');
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[checkout] Stripe error', error);
    return NextResponse.json({ error: 'Payment could not be started. Please try again or contact us.' }, { status: 502 });
  }
}
