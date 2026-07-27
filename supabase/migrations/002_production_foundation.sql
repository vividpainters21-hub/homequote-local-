-- HomeQuote Local production foundation: profiles, secure estimates and project photo storage.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), coalesce(new.raw_user_meta_data->>'phone',''),
    case when new.raw_user_meta_data->>'role' = 'contractor' then 'contractor' else 'homeowner' end)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table estimates add column if not exists customer_price_low_cents bigint;
alter table estimates add column if not exists customer_price_high_cents bigint;
alter table estimates add column if not exists contractor_payout_low_cents bigint;
alter table estimates add column if not exists contractor_payout_high_cents bigint;

create table if not exists project_photos(
  id uuid primary key default gen_random_uuid(),
  project_request_id uuid not null references project_requests(id) on delete cascade,
  uploaded_by uuid not null references profiles(id),
  storage_path text not null unique,
  original_name text not null,
  content_type text,
  created_at timestamptz default now()
);

alter table estimates enable row level security;
alter table project_photos enable row level security;
alter table contractor_profiles enable row level security;
alter table contractor_service_areas enable row level security;
alter table contractor_services enable row level security;

create policy "homeowners read own estimates" on estimates for select using (
  exists(select 1 from project_requests r where r.id=project_request_id and r.homeowner_id=auth.uid())
);
create policy "homeowners insert own estimates" on estimates for insert with check (
  exists(select 1 from project_requests r where r.id=project_request_id and r.homeowner_id=auth.uid())
);
create policy "homeowners read own photos" on project_photos for select using (
  exists(select 1 from project_requests r where r.id=project_request_id and r.homeowner_id=auth.uid())
);
create policy "homeowners add own photos" on project_photos for insert with check (
  uploaded_by=auth.uid() and exists(select 1 from project_requests r where r.id=project_request_id and r.homeowner_id=auth.uid())
);
create policy "contractors manage own profile" on contractor_profiles for all using(id=auth.uid()) with check(id=auth.uid());
create policy "contractors manage own areas" on contractor_service_areas for all using(contractor_id=auth.uid()) with check(contractor_id=auth.uid());
create policy "contractors manage own services" on contractor_services for all using(contractor_id=auth.uid()) with check(contractor_id=auth.uid());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('project-photos','project-photos',false,8388608,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=8388608,allowed_mime_types=excluded.allowed_mime_types;

create policy "users upload into own photo folder" on storage.objects for insert to authenticated
with check(bucket_id='project-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "users read own photo folder" on storage.objects for select to authenticated
using(bucket_id='project-photos' and (storage.foldername(name))[1]=auth.uid()::text);
