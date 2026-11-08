# HomeQuote Local — Setup Checklist

You need three free accounts: **GitHub** (code), **Supabase** (database) and **Vercel** (hosting).
Text and email alerts are optional and can be added later.

## 1. Supabase (database)

1. Create a project at supabase.com.
2. Open **SQL Editor** and run each file in `supabase/migrations/`, in order:
   `001_init.sql`, then `002_production_foundation.sql`, then `003_jobs_portal.sql`.
3. **Project Settings → API**: copy the **Project URL**, the **anon / publishable key** and the **service_role key**.
   The service_role key is a master key. Only ever paste it into Vercel's environment variables.

## 2. Vercel (hosting)

1. Import the GitHub repository at vercel.com → **Add New → Project**.
2. Under **Environment Variables**, add everything from `.env.example` that you have. Required:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` — your site address, e.g. `https://homequote-local.vercel.app`
   - `NEXT_PUBLIC_BUSINESS_NAME` and `NEXT_PUBLIC_BUSINESS_PHONE` — shown to customers
3. Recommended: `ANTHROPIC_API_KEY` for AI estimates (without it, a built-in calculator is used).
4. Deploy. In Supabase, **Authentication → URL Configuration**: set the Site URL to your Vercel address.

## 3. Make your contractor account

1. Go to `/signup` on your site and create your account, then confirm the email.
2. In Supabase **SQL Editor**, run this with your email to give yourself access to the job board:

   ```sql
   update profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```
3. Sign in at `/login`. You land on `/admin`, your job board.

Anyone else who signs up gets no access until you run that command for them.

## 4. Alerts (optional, recommended)

- **Texts:** create a Twilio account and phone number, then set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.
- **Email:** create a Resend account, verify your domain, then set `RESEND_API_KEY` and `EMAIL_FROM` (e.g. `quotes@yourdomain.com`).
- **Where you get alerts:** `CONTRACTOR_PHONE` and `CONTRACTOR_EMAIL`.

Without these, everything still works: the admin page shows each customer's private link so you can text it yourself.

## 5. Test it

1. Open `/request` in a private window and submit a project with your own email.
2. You land on the customer page (`/p/...`). Bookmark it.
3. In `/admin`, open the job, set a price and click **Send quote**.
4. Refresh the customer page, then approve and sign.
5. Back in `/admin`, set a start date and click **Save & tell customer**.

## Troubleshooting

- **"We could not save your request":** `SUPABASE_SERVICE_ROLE_KEY` is missing, or migration 003 was not run.
- **`/admin` keeps sending you to sign in:** your profile's role is not `admin` (step 3.2).
- **Photos fail to upload:** migration 003 creates the `job-photos` bucket; check it exists under **Storage**.
- **Vercel says package.json is missing:** the files are inside an extra folder; move them to the repository root.
