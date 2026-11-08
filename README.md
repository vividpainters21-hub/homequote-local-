# HomeQuote Local

One place for a local contractor and their customers, from first request to finished job.

**Customers** (no account needed)
- Fill out a 3-step request form with photos and get an instant preliminary estimate.
- Get a private project link where they can see their quote, **approve and sign it online**,
  message the contractor, add photos and follow progress (requested → quoted → approved → scheduled → in progress → done).

**The contractor** (`/admin`, sign-in required)
- A job board with every lead, filtered by status, plus pipeline totals.
- Each job shows the customer's details, photos, the AI estimate with line items, crew labor,
  risks to check and questions to ask.
- Turn the estimate into a real quote and send it, schedule the start date, update the status,
  reply to messages and keep private notes.
- Text/email alerts for new leads, customer messages and approvals.

## How it fits together

| Piece | Where |
|---|---|
| Request form | `app/request/page.tsx` → `POST /api/jobs` |
| AI estimate (Claude, guaranteed-valid output; calculator fallback) | `lib/ai-estimate.ts`, `lib/estimate.ts` |
| Customer project page | `app/p/[token]/` + `app/api/p/[token]/` |
| Contractor job board | `app/admin/` + `app/api/admin/jobs/` |
| Text/email alerts (Twilio / Resend, optional) | `lib/notify.ts` |
| Database tables and security rules | `supabase/migrations/003_jobs_portal.sql` |

**Security model:** customers are identified by an unguessable link (144-bit random token). Only server code
with the service-role key reads jobs by token, and it returns customer-safe fields only (no private notes,
crew payout or risk notes). The job tables are readable only by accounts with the `admin` role.
Public endpoints are rate-limited per IP and the request form has a spam trap.

## Run it locally

1. Node.js 20 or newer.
2. Copy `.env.example` to `.env.local` and fill in the Supabase values.
3. `npm install`, then `npm run dev`, then open http://localhost:3000.

Full setup, including making your admin account: **[SETUP-CHECKLIST.md](SETUP-CHECKLIST.md)**.

## Not built yet

- Deposits and payments (Stripe keys are reserved in `.env.example`).
- Multiple contractors / marketplace matching. This version is one business and its customers.
- Rate limiting is per server instance; add Vercel Firewall rate limits for stronger protection.
