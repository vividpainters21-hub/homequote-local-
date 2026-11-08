-- HomeQuote Local: deposits and final payments (Stripe Checkout, plus cash/check recorded by hand).
-- Run after 003_jobs_portal.sql.

alter table public.jobs add column if not exists deposit_percent int not null default 30 check (deposit_percent between 0 and 100);
alter table public.jobs add column if not exists balance_requested_at timestamptz;

create table if not exists public.job_payments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  kind text not null check (kind in ('deposit', 'balance', 'other')),
  method text not null check (method in ('stripe', 'cash', 'check', 'zelle', 'other')),
  amount_cents bigint not null check (amount_cents > 0),
  -- Unique so a webhook delivered twice can never record the same payment twice.
  stripe_session_id text unique,
  stripe_payment_intent text,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists job_payments_job_idx on public.job_payments(job_id, created_at);

alter table public.job_payments enable row level security;
drop policy if exists "admins manage job payments" on public.job_payments;
create policy "admins manage job payments" on public.job_payments for all using (public.is_admin()) with check (public.is_admin());
