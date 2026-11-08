/** Payment math shared by the customer page, the admin page and the checkout route. */

export interface PaymentRow {
  id: string;
  kind: 'deposit' | 'balance' | 'other';
  method: 'stripe' | 'cash' | 'check' | 'zelle' | 'other';
  amount_cents: number;
  note: string;
  created_at: string;
}

export const METHOD_LABEL: Record<PaymentRow['method'], string> = { stripe: 'Card / bank (online)', cash: 'Cash', check: 'Check', zelle: 'Zelle', other: 'Other' };

/** Stripe's minimum charge in USD. */
export const MIN_CHARGE_CENTS = 50;

export function summarizePayments(quoteCents: number | null, depositPercent: number, payments: Pick<PaymentRow, 'amount_cents'>[]) {
  const total = quoteCents ?? 0;
  const paid = payments.reduce((sum, p) => sum + p.amount_cents, 0);
  const remaining = Math.max(0, total - paid);
  const depositTarget = Math.round((total * depositPercent) / 100);
  const depositDue = Math.min(remaining, Math.max(0, depositTarget - paid));
  return { total, paid, remaining, depositTarget, depositDue };
}

/** Statuses where an approved quote can take payment. */
export const PAYABLE_STATUSES = ['approved', 'scheduled', 'in_progress', 'completed'];
