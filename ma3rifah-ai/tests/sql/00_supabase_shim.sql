-- =====================================================================
-- طبقة محاكاة لواجهات Supabase على PostgreSQL عادي
--
-- الغرض: تشغيل ملفات supabase/migrations كما هي — بسياساتها ودوالها —
-- على قاعدة بيانات حقيقية للتحقق من العزل، دون الحاجة إلى مشروع Supabase.
--
-- تُحاكى هنا الواجهات التي تعتمد عليها الهجرات فقط:
--   auth.users · auth.uid() · الأدوار anon/authenticated/service_role
--   storage.buckets · storage.objects · storage.foldername()
--
-- سلوك auth.uid() مطابق لتطبيق Supabase: يقرأ المطالبة sub من
-- إعداد الجلسة request.jwt.claims، وهو ما تضبطه بوابة PostgREST
-- من رمز JWT في الإنتاج.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- الأدوار ----------

do $$ begin
  create role anon nologin noinherit;
exception when duplicate_object then null; end $$;

do $$ begin
  create role authenticated nologin noinherit;
exception when duplicate_object then null; end $$;

do $$ begin
  create role service_role nologin noinherit bypassrls;
exception when duplicate_object then null; end $$;

grant anon, authenticated, service_role to postgres;

-- ---------- مخطط auth ----------

create schema if not exists auth;

create table if not exists auth.users (
  id                   uuid primary key default gen_random_uuid(),
  email                text unique,
  encrypted_password   text,
  raw_user_meta_data   jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user::text)
$$;

-- ---------- مخطط storage ----------

create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets(id) on delete cascade,
  name       text not null,
  owner      uuid,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

-- تُعيد أجزاء المسار عدا اسم الملف — نفس سلوك Supabase
create or replace function storage.foldername(name text)
returns text[]
language plpgsql
immutable
as $$
declare
  parts text[];
begin
  parts := string_to_array(name, '/');
  return parts[1:array_length(parts, 1) - 1];
end;
$$;

-- ---------- الصلاحيات (تضبطها Supabase تلقائيًا) ----------

grant usage on schema public, auth, storage to anon, authenticated, service_role;

-- تمنح Supabase هذه الصلاحيات على جداول التخزين، وتبقى RLS هي الفلتر
grant select on storage.buckets to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant all on storage.buckets, storage.objects to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
