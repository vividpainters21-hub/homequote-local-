# HomeQuote Local — Laptop Setup Checklist

## Part 1: Upload the code to GitHub

1. Download and extract the ZIP.
2. Open the extracted `homequote-local` folder.
3. Confirm you see `app`, `components`, `lib`, `supabase`, and `package.json`.
4. Open your GitHub repository named `homequote-local`.
5. Click **Add file** → **Upload files**.
6. Select everything inside the extracted `homequote-local` folder, or drag all of it into the upload area.
7. Do not upload the ZIP itself.
8. In the commit box, enter `Upload HomeQuote Local MVP`.
9. Click **Commit changes**.

Your repository root should show `package.json` directly. It should not show another `homequote-local` folder that you must open first.

## Part 2: Connect the repository to Vercel

1. Sign in to Vercel with GitHub.
2. Click **Add New** → **Project**.
3. Find `homequote-local` and click **Import**.
4. Framework should be detected as **Next.js**.
5. Before deploying, open **Environment Variables**.

Add these variables:

- `NEXT_PUBLIC_SUPABASE_URL` — your Supabase Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — your Supabase publishable/anon key
- `SUPABASE_SERVICE_ROLE_KEY` — leave blank until you intentionally retrieve it; never expose it publicly
- `ANTHROPIC_API_KEY` — optional at first; without it, the local estimator is used
- `STRIPE_SECRET_KEY` — leave blank until payments are built
- `NEXT_PUBLIC_APP_URL` — your Vercel URL after the first deployment

Never place secret keys in GitHub files, screenshots, or chat messages.

6. Click **Deploy**.

## Part 3: Prepare Supabase

1. Open your Supabase project.
2. Open **SQL Editor**.
3. Open `supabase/migrations/001_init.sql` from the downloaded project, copy all the SQL, and run it.
4. Open `supabase/migrations/002_production_foundation.sql`, copy all the SQL, and run it.
5. Open **Authentication** → **URL Configuration**.
6. Set the Site URL to your Vercel deployment URL.
7. Add the same URL as a redirect URL.

## Part 4: Verify the site

Test these pages:

- `/`
- `/signup`
- `/login`
- `/request`
- `/dashboard`
- `/contractor`
- `/admin`

Create a test homeowner account and submit a sample project.

## Troubleshooting

- **Vercel says package.json is missing:** the files were uploaded inside an extra folder. Move the contents to the repository root.
- **Supabase variables are missing:** add them in Vercel Project Settings → Environment Variables, then redeploy.
- **Login email does not arrive:** check Supabase Authentication settings and spam.
- **AI estimate does not work:** the app will use the local fallback until `ANTHROPIC_API_KEY` is added.
