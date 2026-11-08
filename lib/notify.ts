import 'server-only';

/**
 * Text and email alerts. Both are optional: anything not configured is skipped, and a
 * failed alert never breaks the request that triggered it.
 *   SMS:   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 *   Email: RESEND_API_KEY, EMAIL_FROM (a sender on a domain verified in Resend)
 */

export const businessName = () => process.env.NEXT_PUBLIC_BUSINESS_NAME || 'HomeQuote Local';
export const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
export const customerLink = (token: string) => `${appUrl()}/p/${token}`;

export async function sendSms(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  const phone = toE164(to);
  if (!sid || !token || !from || !phone) return false;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: phone, From: from, Body: body.slice(0, 1500) }),
    });
    if (!res.ok) console.error('[notify] Twilio error', res.status, await res.text());
    return res.ok;
  } catch (error) {
    console.error('[notify] Twilio request failed', error);
    return false;
  }
}

export async function sendEmail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from || !to) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!res.ok) console.error('[notify] Resend error', res.status, await res.text());
    return res.ok;
  } catch (error) {
    console.error('[notify] Resend request failed', error);
    return false;
  }
}

/** Alert the contractor by text and email (whichever is configured). */
export async function notifyContractor(subject: string, text: string) {
  const [sms, email] = await Promise.all([
    process.env.CONTRACTOR_PHONE ? sendSms(process.env.CONTRACTOR_PHONE, `${subject}\n${text}`) : false,
    process.env.CONTRACTOR_EMAIL ? sendEmail(process.env.CONTRACTOR_EMAIL, subject, text) : false,
  ]);
  return { sms, email };
}

/** Alert a customer by email and text, always including their private project link. */
export async function notifyCustomer(job: { customer_email: string; customer_phone: string; public_token: string }, subject: string, text: string) {
  const link = customerLink(job.public_token);
  const full = `${text}\n\nView your project: ${link}\n\n— ${businessName()}`;
  const [email, sms] = await Promise.all([
    sendEmail(job.customer_email, subject, full),
    job.customer_phone ? sendSms(job.customer_phone, `${businessName()}: ${text} ${link}`) : false,
  ]);
  return { email, sms };
}

function toE164(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (raw.trim().startsWith('+') && digits.length >= 10) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}
