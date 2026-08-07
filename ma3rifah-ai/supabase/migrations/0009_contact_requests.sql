-- =====================================================================
-- 0009 — طلبات التواصل من الموقع التسويقي
-- =====================================================================

do $$ begin
  create type public.contact_request_status as enum ('NEW', 'CONTACTED', 'CLOSED');
exception when duplicate_object then null; end $$;

create table if not exists public.contact_requests (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null,
  email        text not null,
  company_name text not null,
  phone        text,
  company_size text,
  message      text not null,
  source       text not null default 'website',
  status       contact_request_status not null default 'NEW',
  created_at   timestamptz not null default now(),
  constraint contact_requests_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint contact_requests_name_not_blank check (length(btrim(full_name)) > 0),
  constraint contact_requests_message_length check (length(btrim(message)) between 5 and 4000)
);

create index if not exists contact_requests_status_idx
  on public.contact_requests (status, created_at desc);

alter table public.contact_requests enable row level security;

-- الكتابة تتم عبر الخادم بمفتاح الخدمة فقط؛ القراءة لمدير المنصة.
drop policy if exists contact_requests_select on public.contact_requests;
create policy contact_requests_select on public.contact_requests
  for select to authenticated
  using (public.is_super_admin());
