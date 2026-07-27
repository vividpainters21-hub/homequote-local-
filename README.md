# HomeQuote Local

HomeQuote Local is a nationwide U.S. home-services marketplace MVP. Homeowners can request AI-assisted preliminary estimates, contractors can receive matched opportunities, and administrators can review and assign projects.

## What is included

- Responsive public homepage
- Nationwide project intake for all 50 states and Washington, D.C.
- Multi-step estimate request wizard
- Service-aware local estimate fallback
- Anthropic Claude estimate API route
- Homeowner, contractor, and administrator dashboards
- Email/password authentication foundation with Supabase
- Database-backed project API for signed-in users
- Private project-photo storage foundation
- Contractor service-area and matching structure
- Supabase SQL migrations with row-level security
- Standalone browser preview at `preview/index.html`

## Fast preview without installation

Open `preview/index.html` in Chrome, Edge, or Safari. The preview stores demo data in that browser only and does not require API keys.

## Run the full application locally

1. Install Node.js 20 or newer.
2. Rename `.env.example` to `.env.local`.
3. Add your Supabase URL and publishable/anon key.
4. Optionally add an Anthropic API key.
5. Open a terminal in this folder.
6. Run `npm install`.
7. Run `npm run dev`.
8. Open `http://localhost:3000`.

## Deploy with GitHub and Vercel

1. Extract this ZIP on your computer.
2. Open the extracted `homequote-local` folder.
3. Upload **the contents inside the folder** to the root of your GitHub repository. Do not upload the outer folder as an extra nested level.
4. Import the repository into Vercel.
5. Add the environment variables listed in `.env.example`.
6. Deploy.
7. Run the SQL migration files in Supabase in numerical order.

Detailed instructions are in `SETUP-CHECKLIST.md`.

## Important status

This is an MVP development build, not yet a fully launched marketplace. Payments, identity/compliance verification, production legal documents, live messaging, notifications, complete photo workflows, and security testing still require further development.
