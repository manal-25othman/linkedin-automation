-- =====================================================================
-- 0002 — الأنواع والجداول الأساسية: الشركات، الأقسام، المستخدمون
-- =====================================================================

-- ---------- الأنواع (Enums) ----------

do $$ begin
  create type public.user_role as enum (
    'SUPER_ADMIN',
    'COMPANY_ADMIN',
    'MANAGER',
    'EMPLOYEE'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.company_status as enum ('ACTIVE', 'SUSPENDED', 'PENDING');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.profile_status as enum ('ACTIVE', 'INVITED', 'DISABLED');
exception when duplicate_object then null; end $$;

-- ---------- دالة مساعدة: تحديث updated_at تلقائيًا ----------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- الشركات (Tenants) ----------

create table if not exists public.companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  logo_url      text,
  industry      text,
  country       text default 'SA',
  timezone      text not null default 'Asia/Riyadh',
  locale        text not null default 'ar',
  status        company_status not null default 'ACTIVE',
  -- إعدادات المساعد الذكي على مستوى الشركة
  ai_settings   jsonb not null default jsonb_build_object(
                  'tone', 'professional',
                  'retrieval_top_k', 8,
                  'min_similarity', 0.30,
                  'max_context_chunks', 6,
                  'history_window', 6,
                  'allow_general_knowledge', false
                ),
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint companies_name_not_blank check (length(btrim(name)) > 0),
  constraint companies_slug_format check (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$')
);

create index if not exists companies_status_idx on public.companies (status);

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- ---------- الأقسام ----------

create table if not exists public.departments (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,
  code        text,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint departments_name_not_blank check (length(btrim(name)) > 0),
  constraint departments_unique_name_per_company unique (company_id, name)
);

create index if not exists departments_company_idx on public.departments (company_id);

drop trigger if exists departments_set_updated_at on public.departments;
create trigger departments_set_updated_at
  before update on public.departments
  for each row execute function public.set_updated_at();

-- ---------- ملفات المستخدمين ----------
-- مرتبطة 1:1 بجدول auth.users الذي تديره Supabase Auth.

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  company_id    uuid references public.companies(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  full_name     text not null default '',
  email         text not null,
  job_title     text,
  avatar_url    text,
  role          user_role not null default 'EMPLOYEE',
  status        profile_status not null default 'ACTIVE',
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- لا يجوز أن يكون الملف بلا شركة إلا في حالتين:
  --   • مدير المنصة (SUPER_ADMIN) فليس تابعًا لأي شركة.
  --   • ملف مؤقت حالته INVITED أنشأه مُحفِّز التسجيل قبل أن يُنشئ
  --     الخادم الشركة ويربطها به. هذه الحالة لا تمنح أي وصول:
  --     getSessionContext ترفض غير ACTIVE، وسياسات RLS ودوال
  --     الاسترجاع تشترط company_id غير فارغ.
  constraint profiles_company_required
    check (
      role = 'SUPER_ADMIN'
      or company_id is not null
      or status = 'INVITED'
    )
);

create index if not exists profiles_company_idx on public.profiles (company_id);
create index if not exists profiles_department_idx on public.profiles (department_id);
create index if not exists profiles_email_idx on public.profiles (lower(email));
create index if not exists profiles_role_idx on public.profiles (company_id, role);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- إنشاء الملف تلقائيًا عند تسجيل مستخدم جديد ----------
-- بيانات الشركة تُمرَّر عبر raw_user_meta_data عند التسجيل،
-- ثم يستكملها التطبيق على الخادم.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- الحالة INVITED مؤقتة: الملف بلا شركة بعد، ولا يمنح أي وصول.
  -- يرفعها الخادم إلى ACTIVE بعد إنشاء الشركة وربطها (bootstrapCompany)
  -- أو عند قبول دعوة من مدير شركة.
  insert into public.profiles (id, email, full_name, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'INVITED'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
