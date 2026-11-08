-- HomeQuote Local: contractor <-> customer job portal.
-- Customers never sign in. Each job has an unguessable public_token, and the server
-- (using the service-role key) is the only thing that reads or writes jobs by token.
-- The contractor signs in, and needs profiles.role = 'admin' (set it by hand, see SETUP-CHECKLIST.md).

create extension if not exists "pgcrypto";

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role in ('admin', 'project_manager'));
$$;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  public_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  status text not null default 'new'
    check (status in ('new', 'quoted', 'approved', 'scheduled', 'in_progress', 'completed', 'lost')),
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null default '',
  address text not null,
  city text not null,
  state text not null,
  zip text not null,
  service text not null,
  description text not null,
  answers jsonb not null default '{}',
  ai_estimate jsonb,
  estimate_low_cents bigint,
  estimate_high_cents bigint,
  quote_cents bigint check (quote_cents is null or quote_cents >= 0),
  quote_details text not null default '',
  quote_sent_at timestamptz,
  approved_at timestamptz,
  approved_signature text,
  approved_ip text,
  scheduled_for date,
  internal_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jobs_status_created_idx on public.jobs(status, created_at desc);

create table if not exists public.job_messages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  sender text not null check (sender in ('customer', 'contractor')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists job_messages_job_idx on public.job_messages(job_id, created_at);

create table if not exists public.job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  content_type text,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists jobs_touch on public.jobs;
create trigger jobs_touch before update on public.jobs for each row execute procedure public.touch_updated_at();

alter table public.jobs enable row level security;
alter table public.job_messages enable row level security;
alter table public.job_photos enable row level security;

-- Only the signed-in contractor (admin) gets direct access. No anonymous policies on purpose.
drop policy if exists "admins manage jobs" on public.jobs;
create policy "admins manage jobs" on public.jobs for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins manage job messages" on public.job_messages;
create policy "admins manage job messages" on public.job_messages for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins manage job photos" on public.job_photos;
create policy "admins manage job photos" on public.job_photos for all using (public.is_admin()) with check (public.is_admin());

-- Private bucket. Uploads and downloads go through short-lived signed URLs made on the server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-photos', 'job-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
