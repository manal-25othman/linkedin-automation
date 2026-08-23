-- ============================================================
-- معرفة AI — كل الهجرات في ملف واحد
-- مولَّد من supabase/migrations/*.sql بـ: npm run db:bundle
-- لا تحرّر هذا الملف يدويًا — عدّل الهجرة الأصلية وأعد التوليد.
--
-- الاستخدام: الصق محتواه كاملًا في Supabase SQL Editor ونفّذه.
-- آمن لإعادة التنفيذ (idempotent).
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- 0001_extensions.sql
-- ═══════════════════════════════════════════════════════════
-- =====================================================================
-- 0001 — الامتدادات المطلوبة
-- =====================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- pgvector: البحث الدلالي عبر المتجهات
create extension if not exists "vector";

-- pg_trgm: البحث النصي التقريبي (يستخدم في البحث الهجين وفي فحص تشابه الأسئلة)
create extension if not exists "pg_trgm";

-- unaccent: تطبيع النصوص العربية/اللاتينية عند البحث
create extension if not exists "unaccent";

-- ═══════════════════════════════════════════════════════════
-- 0002_core_schema.sql
-- ═══════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════
-- 0003_knowledge_schema.sql
-- ═══════════════════════════════════════════════════════════
-- =====================================================================
-- 0003 — قاعدة المعرفة: التصنيفات، المستندات، المقاطع والمتجهات
-- =====================================================================

do $$ begin
  create type public.document_status as enum ('PROCESSING', 'READY', 'FAILED', 'ARCHIVED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.document_visibility as enum ('COMPANY', 'DEPARTMENT', 'ROLE');
exception when duplicate_object then null; end $$;

-- ---------- تصنيفات المعرفة ----------

create table if not exists public.knowledge_categories (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,
  description text,
  icon        text,
  color       text,
  sort_order  int not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint knowledge_categories_name_not_blank check (length(btrim(name)) > 0),
  constraint knowledge_categories_unique_per_company unique (company_id, name)
);

create index if not exists knowledge_categories_company_idx
  on public.knowledge_categories (company_id, sort_order);

drop trigger if exists knowledge_categories_set_updated_at on public.knowledge_categories;
create trigger knowledge_categories_set_updated_at
  before update on public.knowledge_categories
  for each row execute function public.set_updated_at();

-- ---------- المستندات ----------

create table if not exists public.documents (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies(id) on delete cascade,
  category_id           uuid references public.knowledge_categories(id) on delete set null,
  name                  text not null,
  description           text,
  storage_path          text,
  file_url              text,
  file_type             text not null,
  file_size_bytes       bigint not null default 0,
  checksum              text,
  status                document_status not null default 'PROCESSING',
  error_message         text,
  version               int not null default 1,
  -- التحكم في الوصول
  visibility            document_visibility not null default 'COMPANY',
  allowed_department_ids uuid[] not null default '{}',
  allowed_roles         user_role[] not null default '{}',
  -- إحصاءات المعالجة
  page_count            int,
  char_count            int not null default 0,
  chunk_count           int not null default 0,
  processed_at          timestamptz,
  uploaded_by           uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint documents_name_not_blank check (length(btrim(name)) > 0),
  constraint documents_size_positive check (file_size_bytes >= 0)
);

create index if not exists documents_company_idx on public.documents (company_id, created_at desc);
create index if not exists documents_status_idx on public.documents (company_id, status);
create index if not exists documents_category_idx on public.documents (category_id);
create index if not exists documents_name_trgm_idx on public.documents using gin (name gin_trgm_ops);

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- ---------- مقاطع المستندات + المتجهات ----------
-- ملاحظة مهمة: أبعاد المتجه (1024) يجب أن تطابق EMBEDDINGS_DIMENSIONS
-- في ملف البيئة. تغيير المزوّد إلى أبعاد مختلفة يستلزم تعديل هذا العمود
-- وإعادة توليد كل التضمينات.

create table if not exists public.document_chunks (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  document_id  uuid not null references public.documents(id) on delete cascade,
  chunk_index  int not null,
  content      text not null,
  token_count  int not null default 0,
  page_number  int,
  section_title text,
  embedding    vector(1024),
  created_at   timestamptz not null default now(),
  constraint document_chunks_unique_index unique (document_id, chunk_index),
  constraint document_chunks_content_not_blank check (length(btrim(content)) > 0)
);

create index if not exists document_chunks_document_idx on public.document_chunks (document_id, chunk_index);
create index if not exists document_chunks_company_idx on public.document_chunks (company_id);

-- فهرس HNSW للبحث الدلالي بمسافة الكوساين
create index if not exists document_chunks_embedding_idx
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- فهرس نصي للبحث الهجين
create index if not exists document_chunks_content_trgm_idx
  on public.document_chunks using gin (content gin_trgm_ops);

-- ═══════════════════════════════════════════════════════════
-- 0004_conversations_schema.sql
-- ═══════════════════════════════════════════════════════════
-- =====================================================================
-- 0004 — المحادثات، الرسائل، المصادر، وفجوات المعرفة
-- =====================================================================

do $$ begin
  create type public.message_role as enum ('USER', 'ASSISTANT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.answer_status as enum ('ANSWERED', 'UNANSWERED', 'ERROR');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.feedback_value as enum ('UP', 'DOWN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.gap_status as enum ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');
exception when duplicate_object then null; end $$;

-- ---------- المحادثات ----------

create table if not exists public.conversations (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  title          text not null default 'محادثة جديدة',
  message_count  int not null default 0,
  last_message_at timestamptz,
  is_archived    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists conversations_user_idx
  on public.conversations (user_id, last_message_at desc nulls last);
create index if not exists conversations_company_idx
  on public.conversations (company_id, created_at desc);

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

-- ---------- الرسائل ----------

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid references public.profiles(id) on delete set null,
  role            message_role not null,
  content         text not null,
  answer_status   answer_status,
  feedback        feedback_value,
  feedback_note   text,
  latency_ms      int,
  model           text,
  input_tokens    int,
  output_tokens   int,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at);
create index if not exists messages_company_created_idx
  on public.messages (company_id, created_at desc);
create index if not exists messages_unanswered_idx
  on public.messages (company_id, answer_status)
  where answer_status = 'UNANSWERED';

-- ---------- مصادر الإجابة ----------

create table if not exists public.message_sources (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  message_id   uuid not null references public.messages(id) on delete cascade,
  document_id  uuid references public.documents(id) on delete set null,
  chunk_id     uuid references public.document_chunks(id) on delete set null,
  document_name text not null,
  page_number  int,
  section_title text,
  similarity   real,
  excerpt      text,
  created_at   timestamptz not null default now()
);

create index if not exists message_sources_message_idx on public.message_sources (message_id);
create index if not exists message_sources_document_idx on public.message_sources (document_id);

-- ---------- فجوات المعرفة ----------
-- سؤال لم تجد له قاعدة المعرفة إجابة كافية. تُجمَّع الأسئلة المتشابهة
-- في سجل واحد عبر مفتاح تطبيع (normalized_question).

create table if not exists public.knowledge_gaps (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies(id) on delete cascade,
  question             text not null,
  normalized_question  text not null,
  times_asked          int not null default 1,
  department_id        uuid references public.departments(id) on delete set null,
  status               gap_status not null default 'OPEN',
  resolution_note      text,
  linked_document_id   uuid references public.documents(id) on delete set null,
  first_asked_at       timestamptz not null default now(),
  last_asked_at        timestamptz not null default now(),
  resolved_by          uuid references public.profiles(id) on delete set null,
  resolved_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint knowledge_gaps_unique_per_company unique (company_id, normalized_question)
);

create index if not exists knowledge_gaps_company_idx
  on public.knowledge_gaps (company_id, status, times_asked desc);
create index if not exists knowledge_gaps_last_asked_idx
  on public.knowledge_gaps (company_id, last_asked_at desc);

drop trigger if exists knowledge_gaps_set_updated_at on public.knowledge_gaps;
create trigger knowledge_gaps_set_updated_at
  before update on public.knowledge_gaps
  for each row execute function public.set_updated_at();

-- ---------- أحداث التحليلات ----------

create table if not exists public.analytics_events (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  event_type    text not null,
  entity_type   text,
  entity_id     uuid,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists analytics_events_company_type_idx
  on public.analytics_events (company_id, event_type, created_at desc);
create index if not exists analytics_events_created_idx
  on public.analytics_events (company_id, created_at desc);

-- ═══════════════════════════════════════════════════════════
-- 0005_billing_schema.sql
-- ═══════════════════════════════════════════════════════════
-- =====================================================================
-- 0005 — بنية الاشتراكات والاستهلاك وسجلات التدقيق
-- بوابة الدفع غير مربوطة في هذه المرحلة، لكن البنية جاهزة لها.
-- =====================================================================

do $$ begin
  create type public.subscription_status as enum (
    'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.billing_interval as enum ('MONTHLY', 'YEARLY');
exception when duplicate_object then null; end $$;

-- ---------- الخطط ----------
-- الأسعار في قاعدة البيانات وليست ثابتة في الواجهة.

create table if not exists public.plans (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null unique,
  name                  text not null,
  description           text,
  price_amount          numeric(10,2),           -- null = تسعير مخصص (Enterprise)
  currency              text not null default 'SAR',
  billing_interval      billing_interval not null default 'MONTHLY',
  max_users             int,                     -- null = بلا حد
  max_documents         int,
  max_questions_monthly int,
  max_storage_mb        int,
  features              jsonb not null default '[]'::jsonb,
  is_public             boolean not null default true,
  is_custom_priced      boolean not null default false,
  sort_order            int not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint plans_code_format check (code ~ '^[A-Z_]+$')
);

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

-- ---------- الاشتراكات ----------

create table if not exists public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies(id) on delete cascade,
  plan_id              uuid not null references public.plans(id) on delete restrict,
  status               subscription_status not null default 'TRIALING',
  current_period_start timestamptz not null default now(),
  current_period_end   timestamptz not null default (now() + interval '30 days'),
  trial_ends_at        timestamptz,
  canceled_at          timestamptz,
  -- تجاوزات على حدود الخطة عند التفاوض مع عميل معيّن
  limit_overrides      jsonb not null default '{}'::jsonb,
  external_customer_id text,
  external_subscription_id text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint subscriptions_one_active_per_company unique (company_id)
);

create index if not exists subscriptions_status_idx on public.subscriptions (status);
create index if not exists subscriptions_plan_idx on public.subscriptions (plan_id);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ---------- سجلات الاستهلاك الشهري ----------
-- سجل واحد لكل شركة لكل شهر، يُحدَّث تراكميًا.

create table if not exists public.usage_records (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  period_month      date not null,               -- أول يوم من الشهر
  questions_count   int not null default 0,
  documents_count   int not null default 0,
  storage_mb        numeric(12,2) not null default 0,
  input_tokens      bigint not null default 0,
  output_tokens     bigint not null default 0,
  estimated_cost_usd numeric(12,6) not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint usage_records_unique_period unique (company_id, period_month)
);

create index if not exists usage_records_company_idx
  on public.usage_records (company_id, period_month desc);

drop trigger if exists usage_records_set_updated_at on public.usage_records;
create trigger usage_records_set_updated_at
  before update on public.usage_records
  for each row execute function public.set_updated_at();

-- ---------- سجل استدعاءات نماذج الذكاء الاصطناعي ----------
-- للتتبع الدقيق للتكلفة لكل استدعاء.

create table if not exists public.ai_usage_logs (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies(id) on delete cascade,
  user_id            uuid references public.profiles(id) on delete set null,
  operation          text not null,              -- chat | embedding | title
  provider           text not null,              -- anthropic | voyage | openai | local
  model              text not null,
  input_tokens       int not null default 0,
  output_tokens      int not null default 0,
  estimated_cost_usd numeric(12,6) not null default 0,
  latency_ms         int,
  created_at         timestamptz not null default now()
);

create index if not exists ai_usage_logs_company_idx
  on public.ai_usage_logs (company_id, created_at desc);
create index if not exists ai_usage_logs_operation_idx
  on public.ai_usage_logs (company_id, operation, created_at desc);

-- ---------- سجل التدقيق ----------

create table if not exists public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid references public.companies(id) on delete cascade,
  actor_id     uuid references public.profiles(id) on delete set null,
  actor_email  text,
  action       text not null,                    -- document.upload, user.role_changed, ...
  entity_type  text,
  entity_id    uuid,
  metadata     jsonb not null default '{}'::jsonb,
  ip_address   inet,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists audit_logs_company_idx on public.audit_logs (company_id, created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs (company_id, action, created_at desc);

-- ---------- الخطط الافتراضية ----------

insert into public.plans
  (code, name, description, price_amount, currency, billing_interval,
   max_users, max_documents, max_questions_monthly, max_storage_mb,
   features, is_public, is_custom_priced, sort_order)
values
  ('STARTER', 'Starter',
   'للفرق الصغيرة التي تبدأ رحلتها في إدارة المعرفة.',
   499.00, 'SAR', 'MONTHLY',
   50, 100, 5000, 5120,
   '["مساعد ذكي بالعربية والإنجليزية","رفع المستندات ومعالجتها","قاعدة معرفة وتصنيفات","تحليلات أساسية","دعم عبر البريد الإلكتروني"]'::jsonb,
   true, false, 1),

  ('BUSINESS', 'Business',
   'للشركات النامية التي تحتاج تحكمًا وتحليلات أعمق.',
   999.00, 'SAR', 'MONTHLY',
   200, 500, 20000, 25600,
   '["كل مزايا Starter","صلاحيات على مستوى الأقسام","فجوات المعرفة والتوصيات","تحليلات متقدمة","سجل تدقيق كامل","دعم ذو أولوية"]'::jsonb,
   true, false, 2),

  ('ENTERPRISE', 'Enterprise',
   'للمؤسسات الكبيرة ذات المتطلبات الخاصة.',
   null, 'SAR', 'MONTHLY',
   null, null, null, null,
   '["كل مزايا Business","عدد مستخدمين غير محدود","تكاملات مخصصة","اتفاقية مستوى خدمة (SLA)","مدير حساب مخصص","خيارات استضافة خاصة"]'::jsonb,
   true, true, 3)
on conflict (code) do nothing;

-- ═══════════════════════════════════════════════════════════
-- 0006_functions.sql
-- ═══════════════════════════════════════════════════════════
-- =====================================================================
-- 0006 — الدوال المساعدة، البحث الدلالي، وتسجيل فجوات المعرفة
-- كل الدوال هنا تشتق هوية المستخدم من auth.uid() ولا تثق بأي
-- معرّف شركة يمرّره العميل.
-- =====================================================================

-- ---------- دوال سياق المستخدم ----------
-- SECURITY DEFINER لتجنّب التكرار اللانهائي في سياسات RLS على profiles.

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles
  where id = auth.uid() and status = 'ACTIVE'
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles
  where id = auth.uid() and status = 'ACTIVE'
$$;

create or replace function public.current_department_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select department_id from public.profiles
  where id = auth.uid() and status = 'ACTIVE'
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'SUPER_ADMIN' and status = 'ACTIVE'
  )
$$;

create or replace function public.is_company_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('SUPER_ADMIN', 'COMPANY_ADMIN')
      and status = 'ACTIVE'
  )
$$;

create or replace function public.is_manager_or_above()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER')
      and status = 'ACTIVE'
  )
$$;

-- ينتمي السجل إلى شركة المستخدم الحالي (أو المستخدم مدير منصة)
create or replace function public.belongs_to_current_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
     or (p_company_id is not null and p_company_id = public.current_company_id())
$$;

-- ---------- صلاحية قراءة مستند ----------

create or replace function public.can_read_document(
  p_company_id uuid,
  p_visibility public.document_visibility,
  p_allowed_department_ids uuid[],
  p_allowed_roles public.user_role[]
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_company uuid;
  v_department uuid;
begin
  if public.is_super_admin() then
    return true;
  end if;

  select role, company_id, department_id
    into v_role, v_company, v_department
  from public.profiles
  where id = auth.uid() and status = 'ACTIVE';

  if v_role is null or v_company is null or v_company <> p_company_id then
    return false;
  end if;

  -- مدير الشركة يرى كل مستندات شركته
  if v_role = 'COMPANY_ADMIN' then
    return true;
  end if;

  return case p_visibility
    when 'COMPANY'    then true
    when 'DEPARTMENT' then v_department is not null
                           and v_department = any (p_allowed_department_ids)
    when 'ROLE'       then v_role = any (p_allowed_roles)
    else false
  end;
end;
$$;

-- ---------- تطبيع نص السؤال ----------
-- يُستخدم لتجميع الأسئلة المتشابهة في فجوة معرفة واحدة.

create or replace function public.normalize_question(p_text text)
returns text
language sql
immutable
as $$
  select btrim(
    regexp_replace(                          -- توحيد المسافات
      regexp_replace(                        -- إزالة الترقيم
        regexp_replace(                      -- إزالة التشكيل والتطويل
          lower(
            translate(p_text, 'أإآٱىة', 'اااايه')   -- توحيد الهمزات والألف المقصورة والتاء المربوطة
          ),
          '[ً-ْـ]', '', 'g'
        ),
        '[^[:alnum:][:space:]]+', ' ', 'g'
      ),
      '\s+', ' ', 'g'
    )
  )
$$;

-- ---------- البحث الدلالي في مقاطع المستندات ----------
-- تُستدعى بجلسة المستخدم (auth.uid موجود). تُطبّق عزل المستأجر
-- وصلاحيات المستندات داخل الدالة نفسها.

-- يُسقَط أي تعريف سابق أولًا — للسبب نفسه المذكور في 0012.
drop function if exists public.match_document_chunks(vector, int, real, uuid[]);

create or replace function public.match_document_chunks(
  p_query_embedding vector(1024),
  p_match_count int default 8,
  p_min_similarity real default 0.30,
  p_category_ids uuid[] default null
)
returns table (
  chunk_id      uuid,
  document_id   uuid,
  document_name text,
  category_id   uuid,
  content       text,
  page_number   int,
  section_title text,
  similarity    real
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_role public.user_role;
  v_department uuid;
begin
  select company_id, role, department_id
    into v_company, v_role, v_department
  from public.profiles
  where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    raise exception 'unauthorized: no active company profile for current user'
      using errcode = '42501';
  end if;

  -- حدّ أعلى صارم لعدد النتائج للتحكم في التكلفة
  p_match_count := least(greatest(coalesce(p_match_count, 8), 1), 20);

  return query
  select
    c.id,
    c.document_id,
    d.name,
    d.category_id,
    c.content,
    c.page_number,
    c.section_title,
    (1 - (c.embedding <=> p_query_embedding))::real as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where c.company_id = v_company
    and d.company_id = v_company
    and d.status = 'READY'
    and c.embedding is not null
    and (p_category_ids is null or d.category_id = any (p_category_ids))
    and (
      v_role = 'COMPANY_ADMIN'
      or d.visibility = 'COMPANY'
      or (d.visibility = 'DEPARTMENT'
          and v_department is not null
          and v_department = any (d.allowed_department_ids))
      or (d.visibility = 'ROLE' and v_role = any (d.allowed_roles))
    )
    and (1 - (c.embedding <=> p_query_embedding)) >= p_min_similarity
  order by c.embedding <=> p_query_embedding
  limit p_match_count;
end;
$$;

-- ---------- تسجيل فجوة معرفة ----------
-- تُستدعى عندما يعجز المساعد عن الإجابة اعتمادًا على قاعدة المعرفة.

create or replace function public.record_knowledge_gap(p_question text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_department uuid;
  v_normalized text;
  v_gap_id uuid;
begin
  select company_id, department_id
    into v_company, v_department
  from public.profiles
  where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    raise exception 'unauthorized: no active company profile for current user'
      using errcode = '42501';
  end if;

  v_normalized := public.normalize_question(p_question);

  if length(v_normalized) < 3 then
    return null;
  end if;

  insert into public.knowledge_gaps
    (company_id, question, normalized_question, department_id)
  values
    (v_company, left(btrim(p_question), 1000), v_normalized, v_department)
  on conflict (company_id, normalized_question) do update
    set times_asked  = public.knowledge_gaps.times_asked + 1,
        last_asked_at = now(),
        -- إعادة فتح الفجوة إذا سُئلت مجددًا بعد تجاهلها
        status = case
                   when public.knowledge_gaps.status = 'DISMISSED' then 'OPEN'
                   else public.knowledge_gaps.status
                 end
  returning id into v_gap_id;

  return v_gap_id;
end;
$$;

-- ---------- تحديث عدّاد المحادثة ----------

create or replace function public.bump_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
     set message_count = message_count + 1,
         last_message_at = new.created_at,
         updated_at = now()
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_bump_conversation on public.messages;
create trigger messages_bump_conversation
  after insert on public.messages
  for each row execute function public.bump_conversation_on_message();

-- ---------- تسجيل الاستهلاك الشهري ----------

create or replace function public.record_usage(
  p_company_id uuid,
  p_questions int default 0,
  p_input_tokens bigint default 0,
  p_output_tokens bigint default 0,
  p_cost_usd numeric default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usage_records
    (company_id, period_month, questions_count, input_tokens, output_tokens, estimated_cost_usd)
  values
    (p_company_id, date_trunc('month', now())::date,
     p_questions, p_input_tokens, p_output_tokens, p_cost_usd)
  on conflict (company_id, period_month) do update
    set questions_count    = public.usage_records.questions_count + excluded.questions_count,
        input_tokens       = public.usage_records.input_tokens + excluded.input_tokens,
        output_tokens      = public.usage_records.output_tokens + excluded.output_tokens,
        estimated_cost_usd = public.usage_records.estimated_cost_usd + excluded.estimated_cost_usd,
        updated_at         = now();
end;
$$;

-- ---------- التحقق من حدود الخطة قبل السؤال ----------

create or replace function public.check_question_quota()
returns table (allowed boolean, used int, quota int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_quota int;
  v_override int;
  v_used int;
begin
  select company_id into v_company
  from public.profiles where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    return query select false, 0, 0;
    return;
  end if;

  select p.max_questions_monthly,
         nullif(s.limit_overrides ->> 'max_questions_monthly', '')::int
    into v_quota, v_override
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.company_id = v_company;

  v_quota := coalesce(v_override, v_quota);

  select coalesce(u.questions_count, 0) into v_used
  from public.usage_records u
  where u.company_id = v_company
    and u.period_month = date_trunc('month', now())::date;

  v_used := coalesce(v_used, 0);

  -- لا اشتراك أو خطة بلا حد => مسموح
  if v_quota is null then
    return query select true, v_used, -1;
  else
    return query select (v_used < v_quota), v_used, v_quota;
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════
-- 0007_rls_policies.sql
-- ═══════════════════════════════════════════════════════════
-- =====================================================================
-- 0007 — Row Level Security
-- المبدأ: منع افتراضي. كل صف لا ينتمي إلى شركة المستخدم غير مرئي.
-- مفتاح service_role يتجاوز RLS، لذا لا يُستخدم إلا على الخادم
-- وبعد تحقق صريح من الصلاحيات في طبقة التطبيق.
-- =====================================================================

alter table public.companies            enable row level security;
alter table public.departments          enable row level security;
alter table public.profiles             enable row level security;
alter table public.knowledge_categories enable row level security;
alter table public.documents            enable row level security;
alter table public.document_chunks      enable row level security;
alter table public.conversations        enable row level security;
alter table public.messages             enable row level security;
alter table public.message_sources      enable row level security;
alter table public.knowledge_gaps       enable row level security;
alter table public.analytics_events     enable row level security;
alter table public.plans                enable row level security;
alter table public.subscriptions        enable row level security;
alter table public.usage_records        enable row level security;
alter table public.ai_usage_logs        enable row level security;
alter table public.audit_logs           enable row level security;

-- منع أي وصول مجهول افتراضيًا
alter table public.companies            force row level security;
alter table public.documents            force row level security;
alter table public.document_chunks      force row level security;

-- =====================================================================
-- companies
-- =====================================================================

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies
  for select to authenticated
  using (public.is_super_admin() or id = public.current_company_id());

drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies
  for update to authenticated
  using (public.is_super_admin() or (id = public.current_company_id() and public.is_company_admin()))
  with check (public.is_super_admin() or (id = public.current_company_id() and public.is_company_admin()));

drop policy if exists companies_insert on public.companies;
create policy companies_insert on public.companies
  for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists companies_delete on public.companies;
create policy companies_delete on public.companies
  for delete to authenticated
  using (public.is_super_admin());

-- =====================================================================
-- departments
-- =====================================================================

drop policy if exists departments_select on public.departments;
create policy departments_select on public.departments
  for select to authenticated
  using (public.belongs_to_current_company(company_id));

drop policy if exists departments_write on public.departments;
create policy departments_write on public.departments
  for all to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_company_admin())
  with check (public.belongs_to_current_company(company_id) and public.is_company_admin());

-- =====================================================================
-- profiles
-- =====================================================================

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_select_company on public.profiles;
create policy profiles_select_company on public.profiles
  for select to authenticated
  using (public.belongs_to_current_company(company_id));

-- المستخدم يعدّل بياناته الشخصية فقط، ولا يستطيع ترقية نفسه.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and company_id is not distinct from (select p.company_id from public.profiles p where p.id = auth.uid())
    and status = (select p.status from public.profiles p where p.id = auth.uid())
  );

drop policy if exists profiles_admin_manage on public.profiles;
create policy profiles_admin_manage on public.profiles
  for update to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_company_admin())
  with check (
    public.belongs_to_current_company(company_id)
    and public.is_company_admin()
    -- مدير الشركة لا يستطيع ترقية أحد إلى مدير منصة
    and (role <> 'SUPER_ADMIN' or public.is_super_admin())
  );

drop policy if exists profiles_admin_insert on public.profiles;
create policy profiles_admin_insert on public.profiles
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (public.belongs_to_current_company(company_id) and public.is_company_admin() and role <> 'SUPER_ADMIN')
  );

drop policy if exists profiles_admin_delete on public.profiles;
create policy profiles_admin_delete on public.profiles
  for delete to authenticated
  using (public.is_super_admin());

-- =====================================================================
-- knowledge_categories
-- =====================================================================

drop policy if exists knowledge_categories_select on public.knowledge_categories;
create policy knowledge_categories_select on public.knowledge_categories
  for select to authenticated
  using (public.belongs_to_current_company(company_id));

drop policy if exists knowledge_categories_write on public.knowledge_categories;
create policy knowledge_categories_write on public.knowledge_categories
  for all to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_company_admin())
  with check (public.belongs_to_current_company(company_id) and public.is_company_admin());

-- =====================================================================
-- documents
-- =====================================================================

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
  for select to authenticated
  using (
    public.can_read_document(company_id, visibility, allowed_department_ids, allowed_roles)
  );

drop policy if exists documents_write on public.documents;
create policy documents_write on public.documents
  for all to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_company_admin())
  with check (public.belongs_to_current_company(company_id) and public.is_company_admin());

-- =====================================================================
-- document_chunks
-- المقاطع تحمل نص المستند، لذا ترث صلاحياته بالكامل.
-- =====================================================================

drop policy if exists document_chunks_select on public.document_chunks;
create policy document_chunks_select on public.document_chunks
  for select to authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_chunks.document_id
        and public.can_read_document(d.company_id, d.visibility, d.allowed_department_ids, d.allowed_roles)
    )
  );

drop policy if exists document_chunks_write on public.document_chunks;
create policy document_chunks_write on public.document_chunks
  for all to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_company_admin())
  with check (public.belongs_to_current_company(company_id) and public.is_company_admin());

-- =====================================================================
-- conversations — خاصة بصاحبها
-- =====================================================================

drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select to authenticated
  using (user_id = auth.uid() and public.belongs_to_current_company(company_id));

drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations
  for insert to authenticated
  with check (user_id = auth.uid() and company_id = public.current_company_id());

drop policy if exists conversations_update on public.conversations;
create policy conversations_update on public.conversations
  for update to authenticated
  using (user_id = auth.uid() and public.belongs_to_current_company(company_id))
  with check (user_id = auth.uid() and public.belongs_to_current_company(company_id));

drop policy if exists conversations_delete on public.conversations;
create policy conversations_delete on public.conversations
  for delete to authenticated
  using (user_id = auth.uid() and public.belongs_to_current_company(company_id));

-- =====================================================================
-- messages
-- =====================================================================

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
        and public.belongs_to_current_company(c.company_id)
    )
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.user_id = auth.uid()
    )
  );

-- التقييم فقط (👍/👎) — لا يجوز تعديل نص الرسالة بعد إنشائها
drop policy if exists messages_update_feedback on public.messages;
create policy messages_update_feedback on public.messages
  for update to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.user_id = auth.uid()
    )
  );

-- =====================================================================
-- message_sources
-- =====================================================================

drop policy if exists message_sources_select on public.message_sources;
create policy message_sources_select on public.message_sources
  for select to authenticated
  using (
    exists (
      select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_sources.message_id
        and c.user_id = auth.uid()
        and public.belongs_to_current_company(c.company_id)
    )
  );

drop policy if exists message_sources_insert on public.message_sources;
create policy message_sources_insert on public.message_sources
  for insert to authenticated
  with check (company_id = public.current_company_id());

-- =====================================================================
-- knowledge_gaps — يقرأها المديرون فقط
-- =====================================================================

drop policy if exists knowledge_gaps_select on public.knowledge_gaps;
create policy knowledge_gaps_select on public.knowledge_gaps
  for select to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_manager_or_above());

drop policy if exists knowledge_gaps_write on public.knowledge_gaps;
create policy knowledge_gaps_write on public.knowledge_gaps
  for all to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_company_admin())
  with check (public.belongs_to_current_company(company_id) and public.is_company_admin());

-- =====================================================================
-- analytics_events
-- =====================================================================

drop policy if exists analytics_events_select on public.analytics_events;
create policy analytics_events_select on public.analytics_events
  for select to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_manager_or_above());

drop policy if exists analytics_events_insert on public.analytics_events;
create policy analytics_events_insert on public.analytics_events
  for insert to authenticated
  with check (company_id = public.current_company_id());

-- =====================================================================
-- plans — الخطط العامة مقروءة للجميع
-- =====================================================================

drop policy if exists plans_select on public.plans;
create policy plans_select on public.plans
  for select to authenticated, anon
  using (is_public or public.is_super_admin());

drop policy if exists plans_write on public.plans;
create policy plans_write on public.plans
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- =====================================================================
-- subscriptions / usage_records / ai_usage_logs
-- =====================================================================

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_company_admin());

drop policy if exists subscriptions_write on public.subscriptions;
create policy subscriptions_write on public.subscriptions
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists usage_records_select on public.usage_records;
create policy usage_records_select on public.usage_records
  for select to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_company_admin());

drop policy if exists ai_usage_logs_select on public.ai_usage_logs;
create policy ai_usage_logs_select on public.ai_usage_logs
  for select to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_company_admin());

-- =====================================================================
-- audit_logs — قراءة فقط، والكتابة عبر الخادم
-- =====================================================================

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_company_admin());

-- =====================================================================
-- صلاحيات تنفيذ الدوال
-- =====================================================================

revoke all on function public.match_document_chunks(vector, int, real, uuid[]) from public;
grant execute on function public.match_document_chunks(vector, int, real, uuid[]) to authenticated;

revoke all on function public.record_knowledge_gap(text) from public;
grant execute on function public.record_knowledge_gap(text) to authenticated;

revoke all on function public.check_question_quota() from public;
grant execute on function public.check_question_quota() to authenticated;

revoke all on function public.record_usage(uuid, int, bigint, bigint, numeric) from public;
grant execute on function public.record_usage(uuid, int, bigint, bigint, numeric) to service_role;

-- =====================================================================
-- صلاحيات الجداول
--
-- سياسات RLS تحدد *أي الصفوف* يراها الدور، لكنها لا تمنحه الوصول إلى
-- الجدول أصلًا — لا بد من GRANT صريح. تمنح Supabase هذه الصلاحيات
-- تلقائيًا عبر خيار «Automatically expose new tables» في لوحة التحكم،
-- لكن ربط الأمان بخيار في واجهة قد يُبدَّل يجعل السلوك غير مضمون.
--
-- تُمنح هنا صراحةً لسببين: تصبح الهجرة مكتفية بذاتها فتعمل على أي
-- PostgreSQL، ويصير سطح الوصول مقروءًا في الكود لا في إعداد خفي.
-- يمكن بعدها إيقاف ذلك الخيار كما توصي Supabase نفسها.
--
-- المستوى الممنوح هنا يطابق ما تسمح به السياسات أعلاه: الجداول التي
-- لها سياسات كتابة تُمنح CRUD، والسجلات التي تُقرأ فقط (التدقيق
-- والاستهلاك) تُمنح SELECT وحدها — فلا يوجد امتياز بلا سياسة تحرسه.
-- =====================================================================

do $$
declare
  v_table text;
begin
  -- جداول يكتب فيها المستخدم (ضمن حدود سياساته)
  foreach v_table in array array[
    'companies', 'departments', 'profiles', 'knowledge_categories',
    'documents', 'document_chunks', 'conversations', 'messages',
    'message_sources', 'knowledge_gaps', 'analytics_events',
    'plans', 'subscriptions'
  ] loop
    execute format(
      'grant select, insert, update, delete on public.%I to authenticated', v_table);
  end loop;

  -- سجلات للقراءة فقط: لا سياسة كتابة لها، فلا صلاحية كتابة عليها
  -- contact_requests يُنشأ في 0009، وصلاحيته تُمنح هناك
  foreach v_table in array array[
    'usage_records', 'ai_usage_logs', 'audit_logs'
  ] loop
    execute format('grant select on public.%I to authenticated', v_table);
  end loop;
end $$;

-- الزائر بلا جلسة لا يقرأ إلا الخطط (صفحة الأسعار). كل ما عدا ذلك من
-- صفحات التسويق لا يمس قاعدة البيانات، ونموذج «تواصل معنا» يُكتب
-- بمفتاح الخدمة على الخادم.
grant select on public.plans to anon;

-- مفتاح الخدمة يتجاوز RLS أصلًا، لكن الصلاحيات تبقى لازمة
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- ═══════════════════════════════════════════════════════════
-- 0008_storage.sql
-- ═══════════════════════════════════════════════════════════
-- =====================================================================
-- 0008 — التخزين (Supabase Storage)
-- مسار الملف يبدأ دائمًا بمعرّف الشركة: <company_id>/<document_id>/<filename>
-- وهذا ما تعتمد عليه سياسات العزل أدناه.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,                       -- خاص: لا وصول مباشر بدون توقيع
  26214400,                    -- 25 ميجابايت
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/plain',
    'text/csv',
    'text/markdown'
  ]
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = excluded.public;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-assets',
  'company-assets',
  true,                        -- الشعارات والصور العامة
  2097152,                     -- 2 ميجابايت
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;

-- ---------- سياسات bucket المستندات ----------

drop policy if exists documents_storage_read on storage.objects;
create policy documents_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

drop policy if exists documents_storage_insert on storage.objects;
create policy documents_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.is_company_admin()
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

drop policy if exists documents_storage_update on storage.objects;
create policy documents_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and public.is_company_admin()
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

drop policy if exists documents_storage_delete on storage.objects;
create policy documents_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and public.is_company_admin()
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

-- ---------- سياسات bucket أصول الشركة ----------

drop policy if exists company_assets_read on storage.objects;
create policy company_assets_read on storage.objects
  for select to public
  using (bucket_id = 'company-assets');

drop policy if exists company_assets_write on storage.objects;
create policy company_assets_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'company-assets'
    and public.is_company_admin()
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

-- ═══════════════════════════════════════════════════════════
-- 0009_contact_requests.sql
-- ═══════════════════════════════════════════════════════════
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

-- الجدول يُقرأ من لوحة مدير المنصة فقط؛ الكتابة تتم بمفتاح الخدمة على
-- الخادم بعد التحقق من النموذج، فلا يحتاج الزائر أي صلاحية عليه.
grant select on public.contact_requests to authenticated;
grant all on public.contact_requests to service_role;

-- ═══════════════════════════════════════════════════════════
-- 0010_analytics_functions.sql
-- ═══════════════════════════════════════════════════════════
-- =====================================================================
-- 0010 — دوال التحليلات
-- كلها تشتق الشركة من auth.uid() ولا تقبل معرّف شركة من العميل.
-- =====================================================================

-- ---------- إحصاءات لوحة التحكم ----------

create or replace function public.company_dashboard_stats()
returns table (
  users_count           bigint,
  documents_count       bigint,
  documents_ready       bigint,
  documents_processing  bigint,
  conversations_count   bigint,
  questions_count       bigint,
  answered_count        bigint,
  unanswered_count      bigint,
  open_gaps_count       bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  select company_id into v_company
  from public.profiles where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from public.profiles p
       where p.company_id = v_company and p.status = 'ACTIVE'),
    (select count(*) from public.documents d
       where d.company_id = v_company and d.status <> 'ARCHIVED'),
    (select count(*) from public.documents d
       where d.company_id = v_company and d.status = 'READY'),
    (select count(*) from public.documents d
       where d.company_id = v_company and d.status = 'PROCESSING'),
    (select count(*) from public.conversations c
       where c.company_id = v_company),
    (select count(*) from public.messages m
       where m.company_id = v_company and m.role = 'USER'),
    (select count(*) from public.messages m
       where m.company_id = v_company and m.answer_status = 'ANSWERED'),
    (select count(*) from public.messages m
       where m.company_id = v_company and m.answer_status = 'UNANSWERED'),
    (select count(*) from public.knowledge_gaps g
       where g.company_id = v_company and g.status = 'OPEN');
end;
$$;

-- ---------- أكثر الأسئلة تداولًا ----------
-- تجميع الأسئلة المتشابهة عبر نفس دالة التطبيع المستخدمة في فجوات المعرفة.

create or replace function public.company_top_questions(p_limit int default 8)
returns table (
  question    text,
  times_asked bigint,
  answered    bigint,
  unanswered  bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  select company_id into v_company
  from public.profiles where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  p_limit := least(greatest(coalesce(p_limit, 8), 1), 50);

  return query
  with user_questions as (
    select
      m.id,
      m.content,
      m.conversation_id,
      m.created_at,
      public.normalize_question(m.content) as normalized
    from public.messages m
    where m.company_id = v_company
      and m.role = 'USER'
      and length(public.normalize_question(m.content)) >= 3
  ),
  paired as (
    select
      q.normalized,
      q.content,
      (
        select a.answer_status
        from public.messages a
        where a.conversation_id = q.conversation_id
          and a.role = 'ASSISTANT'
          and a.created_at >= q.created_at
        order by a.created_at
        limit 1
      ) as status
    from user_questions q
  )
  select
    (array_agg(p.content order by length(p.content)))[1] as question,
    count(*) as times_asked,
    count(*) filter (where p.status = 'ANSWERED') as answered,
    count(*) filter (where p.status = 'UNANSWERED') as unanswered
  from paired p
  group by p.normalized
  order by count(*) desc, question
  limit p_limit;
end;
$$;

-- ---------- سلسلة زمنية للأسئلة ----------

create or replace function public.company_questions_timeseries(p_days int default 30)
returns table (
  day        date,
  total      bigint,
  answered   bigint,
  unanswered bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  select company_id into v_company
  from public.profiles where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  p_days := least(greatest(coalesce(p_days, 30), 1), 365);

  return query
  select
    series.day::date,
    count(m.id) as total,
    count(m.id) filter (where m.answer_status = 'ANSWERED') as answered,
    count(m.id) filter (where m.answer_status = 'UNANSWERED') as unanswered
  from generate_series(
         (current_date - (p_days - 1) * interval '1 day'),
         current_date,
         interval '1 day'
       ) as series(day)
  left join public.messages m
    on m.company_id = v_company
   and m.role = 'ASSISTANT'
   and m.created_at >= series.day
   and m.created_at < series.day + interval '1 day'
  group by series.day
  order by series.day;
end;
$$;

-- ---------- أكثر المستندات استخدامًا ----------

create or replace function public.company_top_documents(p_limit int default 8)
returns table (
  document_id   uuid,
  document_name text,
  citations     bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  select company_id into v_company
  from public.profiles where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  p_limit := least(greatest(coalesce(p_limit, 8), 1), 50);

  return query
  select
    s.document_id,
    max(s.document_name) as document_name,
    count(*) as citations
  from public.message_sources s
  where s.company_id = v_company
    and s.document_id is not null
  group by s.document_id
  order by count(*) desc
  limit p_limit;
end;
$$;

-- ---------- الاستخدام حسب القسم ----------

create or replace function public.company_department_usage()
returns table (
  department_id   uuid,
  department_name text,
  questions       bigint,
  active_users    bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  select company_id into v_company
  from public.profiles where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  return query
  select
    d.id,
    d.name,
    count(m.id) as questions,
    count(distinct m.user_id) as active_users
  from public.departments d
  left join public.profiles p
    on p.department_id = d.id and p.company_id = v_company
  left join public.messages m
    on m.user_id = p.id and m.role = 'USER' and m.company_id = v_company
  where d.company_id = v_company
  group by d.id, d.name
  order by count(m.id) desc, d.name;
end;
$$;

-- ---------- آخر النشاطات ----------

create or replace function public.company_recent_activity(p_limit int default 12)
returns table (
  id          uuid,
  action      text,
  entity_type text,
  actor_name  text,
  metadata    jsonb,
  created_at  timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_role public.user_role;
begin
  select company_id, role into v_company, v_role
  from public.profiles where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  -- النشاط الإداري مرئي للمديرين فقط
  if v_role not in ('SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER') then
    return;
  end if;

  p_limit := least(greatest(coalesce(p_limit, 12), 1), 50);

  return query
  select
    a.id,
    a.action,
    a.entity_type,
    coalesce(p.full_name, a.actor_email, 'النظام') as actor_name,
    a.metadata,
    a.created_at
  from public.audit_logs a
  left join public.profiles p on p.id = a.actor_id
  where a.company_id = v_company
    and a.action not in ('auth.login')
  order by a.created_at desc
  limit p_limit;
end;
$$;

-- ---------- استخدام الشركة مقابل حدود الخطة ----------

create or replace function public.company_usage_summary()
returns table (
  plan_name              text,
  plan_code              text,
  subscription_status    text,
  period_end             timestamptz,
  users_used             bigint,
  users_limit            int,
  documents_used         bigint,
  documents_limit        int,
  questions_used         int,
  questions_limit        int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  select company_id into v_company
  from public.profiles where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  return query
  select
    pl.name,
    pl.code,
    s.status::text,
    s.current_period_end,
    (select count(*) from public.profiles p
       where p.company_id = v_company and p.status = 'ACTIVE'),
    coalesce(nullif(s.limit_overrides ->> 'max_users', '')::int, pl.max_users),
    (select count(*) from public.documents d
       where d.company_id = v_company and d.status <> 'ARCHIVED'),
    coalesce(nullif(s.limit_overrides ->> 'max_documents', '')::int, pl.max_documents),
    coalesce((select u.questions_count from public.usage_records u
       where u.company_id = v_company
         and u.period_month = date_trunc('month', now())::date), 0),
    coalesce(nullif(s.limit_overrides ->> 'max_questions_monthly', '')::int,
             pl.max_questions_monthly)
  from public.subscriptions s
  join public.plans pl on pl.id = s.plan_id
  where s.company_id = v_company;
end;
$$;

-- ---------- الصلاحيات ----------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'company_dashboard_stats()',
    'company_top_questions(int)',
    'company_questions_timeseries(int)',
    'company_top_documents(int)',
    'company_department_usage()',
    'company_recent_activity(int)',
    'company_usage_summary()'
  ]
  loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════
-- 0011_seed_support.sql
-- ═══════════════════════════════════════════════════════════
-- =====================================================================
-- 0011 — دعم سكربت البيانات التجريبية
--
-- دالة بحث دلالي تأخذ معرّف الشركة صراحةً بدل اشتقاقه من auth.uid().
-- هذا آمن هنا فقط لأن التنفيذ محصور في service_role: صلاحية EXECUTE
-- ممنوعة عن authenticated و anon، فلا يستطيع أي مستخدم عادي استدعاءها
-- ولا تمرير معرّف شركة أخرى.
--
-- لا تمنح هذه الدالة لدور authenticated تحت أي ظرف — استخدم
-- match_document_chunks التي تفرض عزل المستأجر داخليًا.
-- =====================================================================

create or replace function public.seed_match_chunks(
  p_company_id uuid,
  p_query_embedding vector(1024),
  p_match_count int default 6
)
returns table (
  chunk_id      uuid,
  document_id   uuid,
  document_name text,
  content       text,
  page_number   int,
  section_title text,
  similarity    real
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.document_id,
    d.name,
    c.content,
    c.page_number,
    c.section_title,
    (1 - (c.embedding <=> p_query_embedding))::real
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where c.company_id = p_company_id
    and d.status = 'READY'
    and c.embedding is not null
  order by c.embedding <=> p_query_embedding
  limit least(greatest(coalesce(p_match_count, 6), 1), 20);
$$;

revoke all on function public.seed_match_chunks(uuid, vector, int) from public;
revoke all on function public.seed_match_chunks(uuid, vector, int) from authenticated;
revoke all on function public.seed_match_chunks(uuid, vector, int) from anon;
grant execute on function public.seed_match_chunks(uuid, vector, int) to service_role;

-- ═══════════════════════════════════════════════════════════
-- 0012_site_chat_and_analytics.sql
-- ═══════════════════════════════════════════════════════════
-- =====================================================================
-- 0012 — محادثة زوّار الموقع + توسعة التحليلات
--
-- قسمان منفصلان تمامًا:
--
--  (أ) محادثة الزوّار: على مستوى المنصة لا الشركة. جداولها بلا
--      company_id إطلاقًا، فلا سبيل بنيويًا لأن تختلط ببيانات أي
--      شركة. لا يقرأها إلا SUPER_ADMIN، ولا يكتب فيها إلا الخادم
--      عبر مفتاح الخدمة.
--
--  (ب) دوال تحليلات إضافية للشركة: جودة الإجابات، المستخدمون
--      النشطون، ساعات الذروة، التكلفة. كلها تشتق الشركة من
--      auth.uid() ولا تقبل معرّف شركة من العميل — كبقية دوال 0010.
-- =====================================================================

-- =====================================================================
-- (أ) محادثة زوّار الموقع
-- =====================================================================

do $$ begin
  create type public.site_chat_status as enum ('ANSWERED', 'UNANSWERED', 'REFUSED', 'ERROR');
exception when duplicate_object then null; end $$;

-- ---------- الزائر ----------
-- لا يُخزَّن أي معرّف شخصي: visitor_key قيمة عشوائية يولّدها الخادم
-- وتُحفظ في كوكي، ولا تُربط بأي هوية. لا عناوين IP ولا بريد.

create table if not exists public.site_visitors (
  id            uuid primary key default gen_random_uuid(),
  visitor_key   text not null unique,
  message_count int not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  /** مسار الصفحة التي بدأت منها المحادثة — للتحليل لا للتتبّع */
  entry_path    text,
  converted     boolean not null default false
);

create index if not exists site_visitors_last_seen_idx
  on public.site_visitors (last_seen_at desc);

-- ---------- رسائل الزوّار ----------

create table if not exists public.site_chat_messages (
  id            uuid primary key default gen_random_uuid(),
  visitor_id    uuid not null references public.site_visitors(id) on delete cascade,
  role          public.message_role not null,
  content       text not null,
  status        public.site_chat_status,
  latency_ms    int,
  model         text,
  input_tokens  int,
  output_tokens int,
  created_at    timestamptz not null default now()
);

create index if not exists site_chat_messages_visitor_idx
  on public.site_chat_messages (visitor_id, created_at);
create index if not exists site_chat_messages_created_idx
  on public.site_chat_messages (created_at desc);
create index if not exists site_chat_messages_unanswered_idx
  on public.site_chat_messages (status, created_at desc)
  where status = 'UNANSWERED';

alter table public.site_visitors      enable row level security;
alter table public.site_chat_messages enable row level security;

-- القراءة لمدير المنصة وحده. لا سياسة كتابة إطلاقًا: الإدراج يتم
-- بمفتاح الخدمة الذي يتجاوز RLS، فلا يستطيع أي عميل تلويث البيانات.
drop policy if exists site_visitors_select on public.site_visitors;
create policy site_visitors_select on public.site_visitors
  for select to authenticated
  using (public.is_super_admin());

drop policy if exists site_chat_messages_select on public.site_chat_messages;
create policy site_chat_messages_select on public.site_chat_messages
  for select to authenticated
  using (public.is_super_admin());

grant select on public.site_visitors, public.site_chat_messages to authenticated;
grant all on public.site_visitors, public.site_chat_messages to service_role;

-- ---------- إحصاءات الزوّار (لمدير المنصة) ----------

create or replace function public.platform_visitor_stats(p_days int default 30)
returns table (
  visitors_total     bigint,
  visitors_in_period bigint,
  questions_total    bigint,
  answered_count     bigint,
  unanswered_count   bigint,
  converted_count    bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_since timestamptz;
begin
  if not public.is_super_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  v_since := now() - make_interval(days => greatest(coalesce(p_days, 30), 1));

  return query
  select
    (select count(*) from public.site_visitors),
    (select count(*) from public.site_visitors v where v.first_seen_at >= v_since),
    (select count(*) from public.site_chat_messages m
       where m.role = 'USER' and m.created_at >= v_since),
    (select count(*) from public.site_chat_messages m
       where m.status = 'ANSWERED' and m.created_at >= v_since),
    (select count(*) from public.site_chat_messages m
       where m.status = 'UNANSWERED' and m.created_at >= v_since),
    (select count(*) from public.site_visitors v
       where v.converted and v.last_seen_at >= v_since);
end;
$$;

-- ---------- أسئلة الزوّار التي لم تُجب ----------
-- هذه أثمن مخرجات المحادثة التسويقية: ما الذي يسأل عنه المهتمّون ولا
-- يجدون له جوابًا في الموقع.

create or replace function public.platform_visitor_unanswered(p_limit int default 20)
returns table (
  question   text,
  asked_at   timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  p_limit := least(greatest(coalesce(p_limit, 20), 1), 100);

  return query
  select q.content, q.created_at
  from public.site_chat_messages a
  join lateral (
    select m.content, m.created_at
    from public.site_chat_messages m
    where m.visitor_id = a.visitor_id
      and m.role = 'USER'
      and m.created_at <= a.created_at
    order by m.created_at desc
    limit 1
  ) q on true
  where a.status = 'UNANSWERED'
  order by a.created_at desc
  limit p_limit;
end;
$$;

-- =====================================================================
-- (ب) توسعة تحليلات الشركة
-- =====================================================================

-- ---------- جودة الإجابات ----------

-- يُسقَط أي تعريف سابق أولًا: `create or replace` لا يغيّر نوع الإرجاع،
-- فتفشل إعادة تشغيل ملف الترحيلات المجمَّع على قاعدة قائمة.
drop function if exists public.company_answer_quality(int);

create or replace function public.company_answer_quality(p_days int default 30)
returns table (
  answers_total      bigint,
  answers_with_source bigint,
  avg_latency_ms     int,
  feedback_up        bigint,
  feedback_down      bigint,
  feedback_total     bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_since   timestamptz;
begin
  select company_id into v_company
  from public.profiles where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  v_since := now() - make_interval(days => greatest(coalesce(p_days, 30), 1));

  return query
  select
    count(*) filter (where m.role = 'ASSISTANT'),
    count(*) filter (
      where m.role = 'ASSISTANT'
        and exists (select 1 from public.message_sources s where s.message_id = m.id)
    ),
    coalesce(avg(m.latency_ms) filter (where m.role = 'ASSISTANT'), 0)::int,
    count(*) filter (where m.feedback = 'UP'),
    count(*) filter (where m.feedback = 'DOWN'),
    count(*) filter (where m.feedback is not null)
  from public.messages m
  where m.company_id = v_company
    and m.created_at >= v_since;
end;
$$;

-- ---------- المستخدمون النشطون ----------
-- «نشط» = طرح سؤالًا واحدًا على الأقل خلال المدة. الفرق بين هذا وعدد
-- الحسابات هو المؤشر الحقيقي لتبنّي النظام داخل الشركة.

create or replace function public.company_active_users(p_days int default 30)
returns table (
  active_users   bigint,
  total_users    bigint,
  new_users      bigint,
  top_user_name  text,
  top_user_questions bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_since   timestamptz;
begin
  select company_id into v_company
  from public.profiles where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  v_since := now() - make_interval(days => greatest(coalesce(p_days, 30), 1));

  return query
  with top_asker as (
    select p.full_name, count(*) as asked
    from public.messages m
    join public.profiles p on p.id = m.user_id
    where m.company_id = v_company and m.role = 'USER' and m.created_at >= v_since
    group by p.full_name
    order by count(*) desc
    limit 1
  )
  select
    (select count(distinct m.user_id) from public.messages m
       where m.company_id = v_company and m.role = 'USER' and m.created_at >= v_since),
    (select count(*) from public.profiles p
       where p.company_id = v_company and p.status = 'ACTIVE'),
    (select count(*) from public.profiles p
       where p.company_id = v_company and p.created_at >= v_since),
    (select t.full_name from top_asker t),
    (select t.asked from top_asker t);
end;
$$;

-- ---------- ساعات الذروة ----------

create or replace function public.company_hourly_activity(p_days int default 30)
returns table (
  hour_of_day int,
  questions   bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_since   timestamptz;
begin
  select company_id into v_company
  from public.profiles where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  v_since := now() - make_interval(days => greatest(coalesce(p_days, 30), 1));

  return query
  select h.hour::int, coalesce(count(m.id), 0)
  from generate_series(0, 23) as h(hour)
  left join public.messages m
    on m.company_id = v_company
   and m.role = 'USER'
   and m.created_at >= v_since
   and extract(hour from m.created_at at time zone 'Asia/Riyadh') = h.hour
  group by h.hour
  order by h.hour;
end;
$$;

-- ---------- التكلفة والاستهلاك ----------

create or replace function public.company_cost_summary(p_months int default 6)
returns table (
  period_month       date,
  questions_count    int,
  input_tokens       bigint,
  output_tokens      bigint,
  estimated_cost_usd numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  select company_id into v_company
  from public.profiles where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  p_months := least(greatest(coalesce(p_months, 6), 1), 24);

  return query
  select u.period_month, u.questions_count, u.input_tokens, u.output_tokens,
         u.estimated_cost_usd
  from public.usage_records u
  where u.company_id = v_company
    and u.period_month >= date_trunc('month', now())::date
                          - make_interval(months => p_months - 1)
  order by u.period_month;
end;
$$;

-- ---------- الصلاحيات ----------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'company_answer_quality(int)',
    'company_active_users(int)',
    'company_hourly_activity(int)',
    'company_cost_summary(int)',
    'platform_visitor_stats(int)',
    'platform_visitor_unanswered(int)'
  ]
  loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════
-- 0013_answer_verification.sql
-- ═══════════════════════════════════════════════════════════
-- =====================================================================
-- 0013 — التحقق من رسوخ الإجابة في مصادرها
--
-- تُحسب هذه القيم على الخادم بعد التوليد وقبل الحفظ. تخزينها يجعل جودة
-- الإجابات قابلة للقياس عبر الزمن بدل أن تكون انطباعًا: هبوط متوسط
-- الرسوخ في شركة ما إنذار مبكر بأن مستنداتها لم تعد تغطي أسئلتها،
-- وهو ما يسبق مغادرة العميل بأسابيع.
-- =====================================================================

alter table public.messages
  add column if not exists confidence      real,
  add column if not exists groundedness    real,
  -- عدد الأرقام التي وردت في الإجابة بلا أصل في المصادر
  add column if not exists unverified_numbers int not null default 0,
  -- true حين استُنتجت المصادر معجميًا لغياب استشهاد صريح من النموذج
  add column if not exists citations_inferred boolean not null default false;

comment on column public.messages.confidence is
  'درجة ثقة مركّبة ∈ [0,1]: 0.25×التشابه + 0.45×الرسوخ + 0.30×نسبة الأرقام المؤكدة';
comment on column public.messages.groundedness is
  'نسبة رموز الإجابة الموجودة في المصادر ∈ [0,1]';

-- إجابات منخفضة الثقة — أكثر ما يستحق مراجعة مدير الشركة
create index if not exists messages_low_confidence_idx
  on public.messages (company_id, created_at desc)
  where role = 'ASSISTANT' and confidence < 0.5;

-- =====================================================================
-- تحديث تقرير جودة الإجابات
-- =====================================================================

drop function if exists public.company_answer_quality(int);

-- يُسقَط التعريف السابق (0012) أولًا: `create or replace` لا يغيّر نوع
-- الإرجاع، فتفشل إعادة تشغيل الترحيلات على قاعدة قائمة بخطأ
-- «cannot change return type of existing function».
drop function if exists public.company_answer_quality(int);

create or replace function public.company_answer_quality(p_days int default 30)
returns table (
  answers_total        bigint,
  answers_with_source  bigint,
  avg_latency_ms       int,
  feedback_up          bigint,
  feedback_down        bigint,
  feedback_total       bigint,
  avg_confidence       real,
  avg_groundedness     real,
  low_confidence_count bigint,
  unverified_number_answers bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_since   timestamptz;
begin
  select company_id into v_company
  from public.profiles where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  v_since := now() - make_interval(days => greatest(coalesce(p_days, 30), 1));

  return query
  select
    count(*) filter (where m.role = 'ASSISTANT'),
    count(*) filter (
      where m.role = 'ASSISTANT'
        and exists (select 1 from public.message_sources s where s.message_id = m.id)
    ),
    coalesce(avg(m.latency_ms) filter (where m.role = 'ASSISTANT'), 0)::int,
    count(*) filter (where m.feedback = 'UP'),
    count(*) filter (where m.feedback = 'DOWN'),
    count(*) filter (where m.feedback is not null),
    coalesce(avg(m.confidence) filter (where m.role = 'ASSISTANT'), 0)::real,
    coalesce(avg(m.groundedness) filter (where m.role = 'ASSISTANT'), 0)::real,
    count(*) filter (where m.role = 'ASSISTANT' and m.confidence < 0.5),
    count(*) filter (where m.role = 'ASSISTANT' and m.unverified_numbers > 0)
  from public.messages m
  where m.company_id = v_company
    and m.created_at >= v_since;
end;
$$;

revoke all on function public.company_answer_quality(int) from public, anon;
grant execute on function public.company_answer_quality(int) to authenticated;

-- ═══════════════════════════════════════════════════════════
-- 0014_curated_answers_and_notifications.sql
-- ═══════════════════════════════════════════════════════════
-- =====================================================================
-- 0014 — الإجابات المعتمدة والتنبيهات
--
-- تكشف فجوات المعرفة ما لا تجيب عنه المستندات، ثم تقف عند الكشف: يكتب
-- المدير «ملاحظة معالجة» فتُخزَّن ولا تدخل قاعدة المعرفة، فيسمع الموظف
-- «لم أجد معلومات» عن سؤال أُجيب عنه بالفعل. حقل يعطي إحساس الإنجاز
-- بلا أثر أسوأ من غيابه، لأنه يُسكت السؤال دون أن يحلّه.
--
-- الحل هنا: الإجابة المعتمدة **مستند حقيقي** لا نوع جديد من البيانات.
-- بذلك تسري عليها كل الضوابط المثبتة أصلًا — عزل الشركات، صلاحيات
-- الأقسام والأدوار، البحث الدلالي — بلا تعديل حرف في دالة البحث ولا
-- سياسة جديدة يمكن أن تُنسى. أضمن طريق لعدم كسر العزل هو ألّا نضيف
-- مسارًا جديدًا إليه.
-- =====================================================================

-- ---------- مصدر المستند ----------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'document_source') then
    create type public.document_source as enum ('UPLOAD', 'CURATED_ANSWER');
  end if;
end
$$;

alter table public.documents
  add column if not exists source_kind public.document_source not null default 'UPLOAD';

comment on column public.documents.source_kind is
  'UPLOAD = ملف رفعه المستخدم، CURATED_ANSWER = إجابة كتبها مدير الشركة لسدّ فجوة';

-- ---------- ربط الفجوة بإجابتها ----------

alter table public.knowledge_gaps
  add column if not exists answer_text text,
  add column if not exists answer_document_id uuid
    references public.documents(id) on delete set null;

comment on column public.knowledge_gaps.answer_text is
  'نص الإجابة المعتمدة كما كتبها المدير — المصدر، والمستند مشتقّ منه';

-- =====================================================================
-- من سأل الفجوة — لإغلاق الدائرة معه حين تُحلّ
-- =====================================================================

create table if not exists public.knowledge_gap_askers (
  gap_id     uuid not null references public.knowledge_gaps(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  asked_at   timestamptz not null default now(),
  notified_at timestamptz,
  primary key (gap_id, user_id)
);

create index if not exists knowledge_gap_askers_company_idx
  on public.knowledge_gap_askers (company_id, gap_id);

alter table public.knowledge_gap_askers enable row level security;

-- يراها من يرى الفجوات (مدير قسم فأعلى)، وصاحبها يرى صفّه وحده.
drop policy if exists gap_askers_select on public.knowledge_gap_askers;
create policy gap_askers_select on public.knowledge_gap_askers
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and (public.is_manager_or_above() or user_id = auth.uid())
  );

-- لا سياسة كتابة إطلاقًا: التسجيل يتم داخل دالة security definer وحدها.

-- =====================================================================
-- التنبيهات
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type public.notification_type as enum (
      'GAP_ANSWERED',      -- سؤالك الذي لم يجد إجابة صار له جواب
      'GAP_OPENED',        -- سؤال جديد بلا إجابة يحتاج نظر الإدارة
      'DOCUMENT_FAILED',   -- فشلت معالجة مستند
      'DOCUMENT_READY',    -- اكتملت معالجة مستند
      'QUOTA_WARNING',     -- اقتراب الحصة الشهرية من النفاد
      'LOW_CONFIDENCE'     -- إجابات منخفضة الثقة تحتاج مراجعة
    );
  end if;
end
$$;

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  -- المستلم. التنبيه شخصي دائمًا: لا تنبيه «للشركة» يقرؤه الجميع
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        public.notification_type not null,
  title       text not null,
  body        text,
  -- مسار داخل التطبيق ينقل المستخدم إلى موضع الحدث
  link        text,
  entity_type text,
  entity_id   uuid,
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  constraint notifications_title_not_blank check (length(btrim(title)) > 0),
  -- مسار داخلي فقط: قيمة تبدأ بـ// أو بمخطّط تصير إعادة توجيه خارجية
  constraint notifications_link_internal check (
    link is null or (link ~ '^/[^/]' or link = '/')
  )
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

-- منع إغراق المستخدم بتنبيه مكرر عن الحدث نفسه.
--
-- بلا شرط WHERE عمدًا: الفهرس الجزئي لا يصلح مُحكِّمًا لـ ON CONFLICT،
-- فتفشل كل عمليات الإدراج بالخطأ 42P10 ولا يُنشأ تنبيه قط (انظر 0019).
-- والدلالة واحدة على أي حال، لأن NULL مغاير لِـ NULL افتراضًا، فتبقى
-- التنبيهات بلا كيان مسموحة بلا حدّ.
create unique index if not exists notifications_unique_event_idx
  on public.notifications (user_id, type, entity_id);

alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = auth.uid() and company_id = public.current_company_id());

-- لا سياسة إدراج ولا تحديث ولا حذف: الإنشاء بمفتاح الخدمة، والتعليم
-- كمقروء عبر دالة محصورة أدناه. لو فُتح التحديث لصار بوسع المستخدم
-- تعديل نص تنبيهه — وهو ما لا حاجة إليه أصلًا.

-- ---------- تعليم التنبيهات كمقروءة ----------

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  update public.notifications
     set read_at = now()
   where user_id = auth.uid()
     and read_at is null
     and (p_ids is null or id = any (p_ids));

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- =====================================================================
-- تسجيل السائل عند إنشاء الفجوة
-- =====================================================================

create or replace function public.record_knowledge_gap(p_question text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_department uuid;
  v_normalized text;
  v_gap_id uuid;
begin
  select company_id, department_id
    into v_company, v_department
  from public.profiles
  where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    raise exception 'unauthorized: no active company profile for current user'
      using errcode = '42501';
  end if;

  v_normalized := public.normalize_question(p_question);

  if length(v_normalized) < 3 then
    return null;
  end if;

  insert into public.knowledge_gaps
    (company_id, question, normalized_question, department_id)
  values
    (v_company, left(btrim(p_question), 1000), v_normalized, v_department)
  on conflict (company_id, normalized_question) do update
    set times_asked  = public.knowledge_gaps.times_asked + 1,
        last_asked_at = now(),
        -- إعادة فتح الفجوة إذا سُئلت مجددًا بعد تجاهلها
        status = case
                   when public.knowledge_gaps.status = 'DISMISSED' then 'OPEN'
                   else public.knowledge_gaps.status
                 end
  returning id into v_gap_id;

  -- يُحفظ السائل كي يصله التنبيه حين تُحلّ فجوته. بلا هذا تبقى الدائرة
  -- مفتوحة: يُجاب السؤال ولا يعلم صاحبه، فلا يعود ليسأل.
  if v_gap_id is not null then
    insert into public.knowledge_gap_askers (gap_id, user_id, company_id)
    values (v_gap_id, auth.uid(), v_company)
    on conflict (gap_id, user_id) do update set asked_at = now();
  end if;

  return v_gap_id;
end;
$$;

revoke all on function public.record_knowledge_gap(text) from public, anon;
grant execute on function public.record_knowledge_gap(text) to authenticated;

-- =====================================================================
-- عدّاد التنبيهات غير المقروءة
-- =====================================================================

create or replace function public.unread_notification_count()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.notifications
  where user_id = auth.uid() and read_at is null;
$$;

revoke all on function public.unread_notification_count() from public, anon;
grant execute on function public.unread_notification_count() to authenticated;

grant select on public.notifications to authenticated;
grant select on public.knowledge_gap_askers to authenticated;

-- ═══════════════════════════════════════════════════════════
-- 0015_whatsapp_link.sql
-- ═══════════════════════════════════════════════════════════
-- =====================================================================
-- 0015 — ربط واتساب بحساب الموظف
--
-- الخطر الجوهري في أي قناة خارجية: كيف نثبت أن هذا الرقم يخصّ هذا
-- الموظف في هذه الشركة؟ رقم الهاتف وحده لا يثبت شيئًا — يُنتحل،
-- ويُعاد تدويره بعد إلغاء الاشتراك، ويظهر مزوّرًا في بعض الشبكات.
-- ولو ربطناه بالثقة لصار العزل — أثمن ما في المنصة — يُخترق من باب
-- جانبي لا من الباب الذي حصّنّاه.
--
-- لذلك الربط يتطلب إثباتين معًا:
--   ١) جلسة صحيحة في المنصة  ← تُثبت هوية الموظف
--   ٢) رسالة من الرقم نفسه بالرمز ← تُثبت حيازة الهاتف
-- ولا يُقبل أي منهما وحده.
-- =====================================================================

create table if not exists public.whatsapp_links (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  -- بصيغة E.164 بلا رموز: 9665xxxxxxxx
  phone       text,
  -- رمز الربط لمرة واحدة، صالح دقائق معدودة
  link_code   text,
  code_expires_at timestamptz,
  verified_at timestamptz,
  last_used_at timestamptz,
  -- سقف يومي لكل رقم — يمنع استنزاف الرصيد عبر قناة مفتوحة
  messages_today int not null default 0,
  messages_day date,
  created_at  timestamptz not null default now(),
  -- رقم واحد لا يخدم حسابين: التباس الهوية أخطر من منع ربط مشروع
  constraint whatsapp_links_phone_unique unique (phone),
  constraint whatsapp_links_user_unique unique (user_id),
  constraint whatsapp_links_phone_digits check (phone is null or phone ~ '^[0-9]{8,20}$')
);

create index if not exists whatsapp_links_company_idx
  on public.whatsapp_links (company_id);

-- البحث بالرمز أثناء الربط
create index if not exists whatsapp_links_code_idx
  on public.whatsapp_links (link_code)
  where link_code is not null;

alter table public.whatsapp_links enable row level security;

-- يرى المستخدم ربطه هو، ويرى مدير الشركة روابط شركته (لإدارتها)
drop policy if exists whatsapp_links_select on public.whatsapp_links;
create policy whatsapp_links_select on public.whatsapp_links
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and (user_id = auth.uid() or public.is_company_admin())
  );

-- يحذف المستخدم ربطه، ويحذف مدير الشركة أي ربط في شركته
drop policy if exists whatsapp_links_delete on public.whatsapp_links;
create policy whatsapp_links_delete on public.whatsapp_links
  for delete to authenticated
  using (
    company_id = public.current_company_id()
    and (user_id = auth.uid() or public.is_company_admin())
  );

-- لا إدراج ولا تحديث من العميل إطلاقًا: الرمز يولَّد في دالة محصورة،
-- والتحقق يتم بمفتاح الخدمة داخل الويب هوك. لو فُتح الإدراج لأمكن
-- لمستخدم أن يربط رقمًا بنفسه بلا إثبات حيازة الهاتف.

grant select, delete on public.whatsapp_links to authenticated;

-- ---------- توليد رمز الربط ----------

create or replace function public.request_whatsapp_link_code()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_code text;
  v_expires timestamptz;
begin
  select company_id into v_company
  from public.profiles
  where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  -- رمز قصير قابل للكتابة يدويًا على الهاتف، ومن مجموعة بلا محارف
  -- ملتبسة (0/O و1/I) — الالتباس هنا يعني محاولة ربط فاشلة لا أكثر،
  -- لكنه يُحبط المستخدم في أول تجربة.
  v_code := 'MA-' || upper(
    translate(
      encode(gen_random_bytes(5), 'base32'),
      '01IO=', 'ABCDE'
    )
  );
  v_code := left(v_code, 11);
  v_expires := now() + interval '10 minutes';

  insert into public.whatsapp_links (company_id, user_id, link_code, code_expires_at)
  values (v_company, auth.uid(), v_code, v_expires)
  on conflict (user_id) do update
    set link_code = excluded.link_code,
        code_expires_at = excluded.code_expires_at,
        company_id = excluded.company_id,
        -- إعادة طلب الرمز تلغي الربط السابق: من يعيد الربط غالبًا غيّر
        -- رقمه، وإبقاء القديم صالحًا يترك رقمًا مهجورًا يصل إلى معرفة
        -- الشركة.
        phone = null,
        verified_at = null;

  return query select v_code, v_expires;
end;
$$;

revoke all on function public.request_whatsapp_link_code() from public, anon;
grant execute on function public.request_whatsapp_link_code() to authenticated;

-- =====================================================================
-- الاسترجاع لمستخدم بعينه — لقناة بلا جلسة متصفح
--
-- تشتق match_document_chunks الشركة والدور والقسم من auth.uid()، وهو
-- غير موجود في طلب يصل من واتساب. والحل ليس نسخ شرط الصلاحيات في
-- استعلام ثانٍ: تكرار ذلك الشرط هو بالضبط ما يجعل العزل ينكسر يومًا،
-- إذ يُعدَّل أحدهما ويُنسى الآخر.
--
-- لذلك يُستخرج المنطق إلى دالة داخلية واحدة تأخذ المستخدم صراحةً،
-- وتناديها النسخة العامة بـauth.uid()، والنسخة الخدمية بمعرّف يتحقق
-- منه الخادم من ربط هاتف موثّق. مصدر واحد للحقيقة.
-- =====================================================================

create or replace function public.match_chunks_for_user(
  p_user_id uuid,
  p_query_embedding vector(1024),
  p_match_count int default 8,
  p_min_similarity real default 0.30,
  p_category_ids uuid[] default null
)
returns table (
  chunk_id      uuid,
  document_id   uuid,
  document_name text,
  category_id   uuid,
  content       text,
  page_number   int,
  section_title text,
  similarity    real
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_role public.user_role;
  v_department uuid;
begin
  select company_id, role, department_id
    into v_company, v_role, v_department
  from public.profiles
  where id = p_user_id and status = 'ACTIVE';

  if v_company is null then
    raise exception 'unauthorized: no active company profile'
      using errcode = '42501';
  end if;

  p_match_count := least(greatest(coalesce(p_match_count, 8), 1), 20);

  return query
  select
    c.id,
    c.document_id,
    d.name,
    d.category_id,
    c.content,
    c.page_number,
    c.section_title,
    (1 - (c.embedding <=> p_query_embedding))::real as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where c.company_id = v_company
    and d.company_id = v_company
    and d.status = 'READY'
    and c.embedding is not null
    and (p_category_ids is null or d.category_id = any (p_category_ids))
    and (
      v_role = 'COMPANY_ADMIN'
      or d.visibility = 'COMPANY'
      or (d.visibility = 'DEPARTMENT'
          and v_department is not null
          and v_department = any (d.allowed_department_ids))
      or (d.visibility = 'ROLE' and v_role = any (d.allowed_roles))
    )
    and (1 - (c.embedding <=> p_query_embedding)) >= p_min_similarity
  order by c.embedding <=> p_query_embedding
  limit p_match_count;
end;
$$;

-- محجوبة عن المستخدمين: تأخذ معرّف مستخدم صراحةً، فلو نُفِّذت من عميل
-- لأمكن انتحال أي هوية. التنفيذ لمفتاح الخدمة وحده.
revoke all on function public.match_chunks_for_user(uuid, vector, int, real, uuid[])
  from public, anon, authenticated;

-- النسخة العامة تصير غلافًا رقيقًا فوق المنطق نفسه
-- يُسقَط التعريف السابق (0006) أولًا — للسبب نفسه المذكور في 0013.
drop function if exists public.match_document_chunks(vector, int, real, uuid[]);

create or replace function public.match_document_chunks(
  p_query_embedding vector(1024),
  p_match_count int default 8,
  p_min_similarity real default 0.30,
  p_category_ids uuid[] default null
)
returns table (
  chunk_id      uuid,
  document_id   uuid,
  document_name text,
  category_id   uuid,
  content       text,
  page_number   int,
  section_title text,
  similarity    real
)
language sql
stable
security definer
set search_path = public
as $$
  select * from public.match_chunks_for_user(
    auth.uid(), p_query_embedding, p_match_count, p_min_similarity, p_category_ids
  );
$$;

revoke all on function public.match_document_chunks(vector, int, real, uuid[]) from public, anon;
grant execute on function public.match_document_chunks(vector, int, real, uuid[]) to authenticated;

-- ═══════════════════════════════════════════════════════════
-- 0016_support.sql
-- ═══════════════════════════════════════════════════════════
-- =====================================================================
-- 0016 — الدعم الفني: قناة بين الشركة ومالك المنصة
--
-- بلا هذه القناة يصل عطل العميل عبر واتساب أو مكالمة، فيضيع بلا أثر:
-- لا يُعرف كم بلاغًا ورد، ولا كم بقي مفتوحًا، ولا أي شركة تعاني أكثر.
-- ومؤشر «كم شكوى في هذه الشركة» هو أبكر إنذار بمغادرة عميل.
--
-- ملاحظة عزل: التذكرة تحمل company_id، فيراها موظفو شركتها ومالك
-- المنصة وحدهم. ولا يرى مالك المنصة **محتوى مستندات** أي شركة — ما
-- يراه هو ما كتبه العميل في التذكرة عمدًا.
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ticket_status') then
    create type public.ticket_status as enum ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
  end if;
  if not exists (select 1 from pg_type where typname = 'ticket_priority') then
    create type public.ticket_priority as enum ('LOW', 'NORMAL', 'HIGH', 'URGENT');
  end if;
end
$$;

create table if not exists public.support_tickets (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  created_by  uuid references public.profiles(id) on delete set null,
  subject     text not null,
  category    text,
  status      public.ticket_status not null default 'OPEN',
  priority    public.ticket_priority not null default 'NORMAL',
  -- يُحدَّث مع كل رسالة، فيُرتَّب به دون مسح الرسائل
  last_reply_at timestamptz not null default now(),
  -- هل آخر ردّ من المنصة؟ يميّز ما ينتظر ردّي عمّا ينتظر العميل
  awaiting_platform boolean not null default true,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint support_tickets_subject_not_blank check (length(btrim(subject)) > 0)
);

create index if not exists support_tickets_company_idx
  on public.support_tickets (company_id, created_at desc);
create index if not exists support_tickets_open_idx
  on public.support_tickets (status, last_reply_at desc)
  where status in ('OPEN', 'IN_PROGRESS');

create table if not exists public.support_messages (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.support_tickets(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null,
  -- true إذا كان الكاتب مالك المنصة — يحدّد جهة الرسالة في العرض
  from_platform boolean not null default false,
  body       text not null,
  created_at timestamptz not null default now(),
  constraint support_messages_body_not_blank check (length(btrim(body)) > 0)
);

create index if not exists support_messages_ticket_idx
  on public.support_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

-- ---------- سياسات التذاكر ----------

drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select on public.support_tickets
  for select to authenticated
  using (public.is_super_admin() or company_id = public.current_company_id());

-- ينشئ التذكرة أي مستخدم نشط في شركته — العطل قد يصيب موظفًا لا مديرًا
drop policy if exists support_tickets_insert on public.support_tickets;
create policy support_tickets_insert on public.support_tickets
  for insert to authenticated
  with check (company_id = public.current_company_id() and created_by = auth.uid());

-- التحديث (الحالة والأولوية) لمالك المنصة وحده: لو ملك العميل إغلاق
-- تذكرته وفتحها لصار مؤشر «كم بقي مفتوحًا» بلا معنى.
drop policy if exists support_tickets_update on public.support_tickets;
create policy support_tickets_update on public.support_tickets
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---------- سياسات الرسائل ----------

drop policy if exists support_messages_select on public.support_messages;
create policy support_messages_select on public.support_messages
  for select to authenticated
  using (public.is_super_admin() or company_id = public.current_company_id());

-- يكتب العميل رسائل شركته بلا وسم «من المنصة»، ويكتب مالك المنصة بوسمه.
-- الشرط يمنع انتحال جهة الرسالة: عميل يضع from_platform = true يجعل
-- ردّه يبدو ردًّا رسميًا من المنصة أمام زملائه.
drop policy if exists support_messages_insert on public.support_messages;
create policy support_messages_insert on public.support_messages
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      (public.is_super_admin() and from_platform = true)
      or (company_id = public.current_company_id() and from_platform = false)
    )
  );

grant select, insert on public.support_tickets to authenticated;
grant update on public.support_tickets to authenticated;
grant select, insert on public.support_messages to authenticated;

-- ---------- تحديث التذكرة عند كل رسالة ----------

create or replace function public.bump_ticket_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_tickets
     set last_reply_at = new.created_at,
         -- ردّ المنصة يُخرج التذكرة من طابور انتظاري، ورسالة العميل تُعيدها
         awaiting_platform = not new.from_platform,
         status = case
                    when new.from_platform then status
                    when status in ('RESOLVED', 'CLOSED') then 'OPEN'
                    else status
                  end
   where id = new.ticket_id;
  return new;
end;
$$;

drop trigger if exists support_messages_bump on public.support_messages;
create trigger support_messages_bump
  after insert on public.support_messages
  for each row execute function public.bump_ticket_on_message();

-- =====================================================================
-- ملخّص الشركات لمالك المنصة — مصدر التصدير إلى Excel
--
-- يُجمَّع في دالة واحدة بدل استعلامات متفرقة في الواجهة: التصدير
-- والعرض يقرآن الأرقام نفسها، فلا يختلف ما تراه عمّا تُرسله للعميل.
-- =====================================================================

create or replace function public.platform_companies_report()
returns table (
  company_id      uuid,
  company_name    text,
  status          public.company_status,
  is_demo         boolean,
  plan_name       text,
  subscription_status public.subscription_status,
  users_count     bigint,
  documents_count bigint,
  questions_count bigint,
  unanswered_count bigint,
  open_tickets    bigint,
  last_activity_at timestamptz,
  created_at      timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.name,
    c.status,
    c.is_demo,
    p.name,
    s.status,
    (select count(*) from public.profiles pr
      where pr.company_id = c.id and pr.status <> 'DISABLED'),
    (select count(*) from public.documents d
      where d.company_id = c.id and d.status <> 'ARCHIVED'),
    (select count(*) from public.messages m
      where m.company_id = c.id and m.role = 'USER'),
    (select count(*) from public.messages m
      where m.company_id = c.id and m.answer_status = 'UNANSWERED'),
    (select count(*) from public.support_tickets t
      where t.company_id = c.id and t.status in ('OPEN', 'IN_PROGRESS')),
    (select max(m.created_at) from public.messages m where m.company_id = c.id),
    c.created_at
  from public.companies c
  left join public.subscriptions s on s.company_id = c.id
  left join public.plans p on p.id = s.plan_id
  order by c.created_at desc;
end;
$$;

revoke all on function public.platform_companies_report() from public, anon;
grant execute on function public.platform_companies_report() to authenticated;

-- ═══════════════════════════════════════════════════════════
-- 0017_cost_breakdown.sql
-- ═══════════════════════════════════════════════════════════
-- =====================================================================
-- 0017 — تفصيل التكلفة والهامش لكل شركة
--
-- مفتاح واحد يخدم كل العملاء، فالفاتورة تصل مجمّعة. والسؤال الذي يحدّد
-- بقاء المشروع ليس «كم أنفقت» بل «كم أنفقتُ على من» — فشركة واحدة
-- تستهلك ضعف اشتراكها تأكل هامش أربع شركات رابحة، ولا يظهر ذلك في
-- المجموع أبدًا.
-- =====================================================================

create or replace function public.company_cost_breakdown(
  p_company_id uuid,
  p_months int default 6
)
returns table (
  period_month     date,
  operation        text,
  calls            bigint,
  input_tokens     bigint,
  output_tokens    bigint,
  cost_usd         numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- مالك المنصة لأي شركة، ومدير الشركة لشركته وحدها
  if not (
    public.is_super_admin()
    or (p_company_id = public.current_company_id() and public.is_company_admin())
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  return query
  select
    date_trunc('month', l.created_at)::date,
    l.operation,
    count(*),
    sum(l.input_tokens)::bigint,
    sum(l.output_tokens)::bigint,
    sum(l.estimated_cost_usd)
  from public.ai_usage_logs l
  where l.company_id = p_company_id
    and l.created_at >= date_trunc('month', now())
        - make_interval(months => greatest(coalesce(p_months, 6), 1) - 1)
  group by 1, 2
  order by 1 desc, 6 desc;
end;
$$;

revoke all on function public.company_cost_breakdown(uuid, int) from public, anon;
grant execute on function public.company_cost_breakdown(uuid, int) to authenticated;

-- =====================================================================
-- الهامش لكل شركة — لمالك المنصة
--
-- يقارن تكلفة الشهر الجاري باشتراك الشركة، فيظهر من يربح ومن يخسر.
-- تسعير Enterprise مخصّص فيعود null، ولا يُخمَّن.
-- =====================================================================

create or replace function public.platform_margin_report()
returns table (
  company_id     uuid,
  company_name   text,
  plan_name      text,
  price_amount   numeric,
  currency       text,
  cost_usd_month numeric,
  questions_month bigint,
  questions_limit int,
  cost_ratio     numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.name,
    p.name,
    p.price_amount,
    p.currency,
    coalesce(u.estimated_cost_usd, 0),
    coalesce(u.questions_count, 0)::bigint,
    p.max_questions_monthly,
    -- نسبة التكلفة إلى الاشتراك. يُحوَّل الريال إلى الدولار بسعر ثابت
    -- (الريال مربوط بالدولار)، فالنسبة تقديرية لا محاسبية.
    case
      when p.price_amount is null or p.price_amount = 0 then null
      else round(
        (coalesce(u.estimated_cost_usd, 0) / (p.price_amount / 3.75)) * 100,
        1
      )
    end
  from public.companies c
  left join public.subscriptions s on s.company_id = c.id
  left join public.plans p on p.id = s.plan_id
  left join public.usage_records u
    on u.company_id = c.id and u.period_month = date_trunc('month', now())::date
  order by coalesce(u.estimated_cost_usd, 0) desc;
end;
$$;

revoke all on function public.platform_margin_report() from public, anon;
grant execute on function public.platform_margin_report() to authenticated;

-- ═══════════════════════════════════════════════════════════
-- 0018_backfill_gap_askers.sql
-- ═══════════════════════════════════════════════════════════
-- =====================================================================
-- 0018 — استرجاع أصحاب الأسئلة، وتثبيت دالة تسجيل الفجوة
--
-- العطل: يكتب المدير إجابةً لفجوة فلا يصل صاحبَ السؤال شيء. والسبب أن
-- جدول `knowledge_gap_askers` فارغ، فلا تجد المنصةُ أحدًا تُبلّغه.
--
-- ولذلك سببان مستقلّان:
--
--   ١) قواعد البيانات التي طُبِّق عليها الترحيل 0006 دون 0014 ما زالت
--      تحمل النسخة القديمة من `record_knowledge_gap` — وهي لا تسجّل
--      السائل إطلاقًا. يُعاد تعريف الدالة هنا لتثبيتها على النسخة
--      الصحيحة أيًّا كان ما سبق.
--
--   ٢) الفجوات المسجّلة قبل ذلك لا سائل لها ولن يكون لها أبدًا — فلا
--      يكفي إصلاح المستقبل. تُستخرج أصحابها هنا من الرسائل نفسها:
--      `messages.user_id` يحمل صاحب كل سؤال، والمطابقة على الصيغة
--      المعيارية للسؤال هي المطابقة عينها التي أنشأت الفجوة، فلا تخمين
--      فيها.
--
-- والترحيل كله قابل لإعادة التشغيل بلا أثر جانبي.
-- =====================================================================

-- ---------- ١) تثبيت دالة تسجيل الفجوة ----------

create or replace function public.record_knowledge_gap(p_question text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_department uuid;
  v_normalized text;
  v_gap_id uuid;
begin
  select company_id, department_id
    into v_company, v_department
  from public.profiles
  where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    raise exception 'unauthorized: no active company profile for current user'
      using errcode = '42501';
  end if;

  v_normalized := public.normalize_question(p_question);

  if length(v_normalized) < 3 then
    return null;
  end if;

  insert into public.knowledge_gaps
    (company_id, question, normalized_question, department_id)
  values
    (v_company, left(btrim(p_question), 1000), v_normalized, v_department)
  on conflict (company_id, normalized_question) do update
    set times_asked   = public.knowledge_gaps.times_asked + 1,
        last_asked_at = now(),
        -- إعادة فتح الفجوة إذا سُئلت مجددًا بعد تجاهلها
        status = case
                   when public.knowledge_gaps.status = 'DISMISSED' then 'OPEN'
                   else public.knowledge_gaps.status
                 end
  returning id into v_gap_id;

  -- يُحفظ السائل كي يصله التنبيه حين تُحلّ فجوته. بلا هذا تبقى الدائرة
  -- مفتوحة: يُجاب السؤال ولا يعلم صاحبه، فلا يعود ليسأل.
  if v_gap_id is not null then
    insert into public.knowledge_gap_askers (gap_id, user_id, company_id)
    values (v_gap_id, auth.uid(), v_company)
    on conflict (gap_id, user_id) do update set asked_at = now();
  end if;

  return v_gap_id;
end;
$$;

revoke all on function public.record_knowledge_gap(text) from public, anon;
grant execute on function public.record_knowledge_gap(text) to authenticated;

-- ---------- ٢) استرجاع أصحاب الفجوات القائمة ----------
--
-- الشرط `g.company_id = m.company_id` ليس زينة: بدونه يمكن أن يُنسب
-- سؤالٌ في شركة إلى موظف في أخرى لو تطابق نصّ السؤال — وهو تطابق
-- متوقّع تمامًا في أسئلة مثل «كم أيام الإجازة السنوية». الخلط هنا
-- يسرّب اسم موظف من شركة إلى لوحة شركة أخرى، وهو ما لا يُغتفر.

insert into public.knowledge_gap_askers (gap_id, user_id, company_id, asked_at)
select
  g.id,
  m.user_id,
  g.company_id,
  min(m.created_at)
from public.knowledge_gaps g
join public.messages m
  on  m.company_id = g.company_id
  and m.role = 'USER'
  and m.user_id is not null
  and public.normalize_question(m.content) = g.normalized_question
group by g.id, m.user_id, g.company_id
on conflict (gap_id, user_id) do nothing;

-- ═══════════════════════════════════════════════════════════
-- 0019_fix_notification_dedupe_index.sql
-- ═══════════════════════════════════════════════════════════
-- =====================================================================
-- 0019 — إصلاح فهرس منع تكرار التنبيهات
--
-- العطل: لم يُنشأ أي تنبيه قط. لا حين تُفتح فجوة، ولا حين تُجاب.
--
-- السبب أن الفهرس الفريد في الترحيل 0014 كُتب جزئيًا:
--
--     create unique index … on notifications (user_id, type, entity_id)
--       where entity_id is not null;
--
-- والفهرس الجزئي لا يصلح مُحكِّمًا لـ ON CONFLICT إلا إذا حمل الأمرُ
-- شرطًا يطابق شرط الفهرس. فكل إدراج للتنبيهات — وهو يمرّ بـ ON CONFLICT
-- لمنع التكرار — كان يفشل بالخطأ 42P10:
--
--     there is no unique or exclusion constraint matching
--     the ON CONFLICT specification
--
-- والفشل صامت تمامًا: طبقة التنبيهات لا ترمي عمدًا كي لا يُفشِل تنبيهٌ
-- ضائعٌ عمليةً نجحت. فكان المدير يكتب الإجابة، ويقول النظام «تم الحفظ»،
-- ولا يصل أحدًا شيء — بلا خطأ في الواجهة ولا أثر يُلاحَظ.
--
-- والعلاج إسقاط الشرط. والدلالة محفوظة كما هي:
--
--   • entity_id موجود ⇒ تنبيه واحد لكل (مستلم، نوع، كيان) — وهو المراد.
--   • entity_id فارغ  ⇒ NULL في Postgres مغاير لِـ NULL افتراضًا، فتبقى
--     التنبيهات العامة بلا كيان مسموحة بلا حدّ — تمامًا كما كان الشرط
--     الجزئي يفعل.
--
-- أي أن الشرط لم يكن يضيف شيئًا سوى تعطيل الفهرس عن أداء وظيفته.
-- =====================================================================

drop index if exists public.notifications_unique_event_idx;

create unique index if not exists notifications_unique_event_idx
  on public.notifications (user_id, type, entity_id);

comment on index public.notifications_unique_event_idx is
  'يمنع تكرار التنبيه عن الحدث نفسه، ويصلح مُحكِّمًا لـ ON CONFLICT. '
  'لا تُعِد إليه شرط WHERE: الشرط يُبطل عمله مُحكِّمًا فتفشل كل الإدراجات.';

-- ═══════════════════════════════════════════════════════════
-- 0020_plan_limits.sql
-- ═══════════════════════════════════════════════════════════
-- =====================================================================
-- 0020 — فرض حدود الخطة: المستخدمون والمستندات والتخزين
--
-- كانت هذه الحدود تُعرض على صفحة الأسعار وتُخزَّن في جدول `plans` ولا
-- تُفحص في أي مكان. فشركة على خطة Starter (٥٠ مستخدمًا، ١٠٠ مستند)
-- تستطيع إضافة ٥٠٠ مستخدم و١٠٬٠٠٠ مستند بلا مانع.
--
-- وهذا لا يُقاس بخسارة إيراد فحسب: خطة لا تُفرض حدودها تجعل الفرق بين
-- ٤٩٩ و٩٩٩ ريالًا وعدًا لا يقابله شيء، فلا يبقى سبب يدفع عميلًا
-- للترقية — وهو ما يُبطل التسعير كله قبل أن تُربط بوابة الدفع.
--
-- والحصة الشهرية للأسئلة كانت مفروضة وحدها (check_question_quota).
-- تتبع الدوالّ هنا نمطها عينه: نفس بنية الإرجاع، ونفس احترام
-- `limit_overrides` المتفاوَض عليها لكل عميل، ونفس معاملة NULL بوصفها
-- «بلا حد».
-- =====================================================================

-- ---------- حدّ الخطة النافذ ----------
--
-- تُقرأ القيمة من الخطة، ويعلوها تجاوزُ الاشتراك إن وُجد. دالة واحدة
-- كي لا تتكرر قاعدة الأولوية في كل موضع فتختلف بمرور الوقت.

create or replace function public.effective_plan_limit(
  p_company uuid,
  p_key text
)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit int;
  v_override int;
begin
  -- المفتاح يُقصر على المعروف: القيمة تدخل في تعبير ديناميكي أدناه،
  -- وقائمة بيضاء أوثق من أي تهريب.
  if p_key not in ('max_users', 'max_documents', 'max_storage_mb', 'max_questions_monthly') then
    raise exception 'unknown plan limit key: %', p_key using errcode = '22023';
  end if;

  execute format(
    'select p.%I from public.subscriptions s
       join public.plans p on p.id = s.plan_id
      where s.company_id = $1',
    p_key
  )
  into v_limit
  using p_company;

  select nullif(s.limit_overrides ->> p_key, '')::int
    into v_override
  from public.subscriptions s
  where s.company_id = p_company;

  return coalesce(v_override, v_limit);
end;
$$;

-- ---------- حدّ المستخدمين ----------
--
-- يُحتسب النشط والمدعو معًا: المدعو مقعد محجوز فعلًا، ولو لم يُحتسب
-- لأمكن تجاوز الحدّ بدعوات معلّقة ثم تفعيلها دفعةً واحدة.

create or replace function public.check_user_quota()
returns table (allowed boolean, used int, quota int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_quota int;
  v_used int;
begin
  select company_id into v_company
  from public.profiles where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    return query select false, 0, 0;
    return;
  end if;

  v_quota := public.effective_plan_limit(v_company, 'max_users');

  select count(*)::int into v_used
  from public.profiles
  where company_id = v_company and status in ('ACTIVE', 'INVITED');

  if v_quota is null then
    return query select true, v_used, -1;
  else
    return query select (v_used < v_quota), v_used, v_quota;
  end if;
end;
$$;

-- ---------- حدّ المستندات ----------
--
-- المؤرشف لا يُحتسب: هو خارج قاعدة المعرفة ولا يستهلك تضمينات، وعدّه
-- يعاقب الشركة على حسن التنظيم.

create or replace function public.check_document_quota()
returns table (allowed boolean, used int, quota int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_quota int;
  v_used int;
begin
  select company_id into v_company
  from public.profiles where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    return query select false, 0, 0;
    return;
  end if;

  v_quota := public.effective_plan_limit(v_company, 'max_documents');

  select count(*)::int into v_used
  from public.documents
  where company_id = v_company and status <> 'ARCHIVED';

  if v_quota is null then
    return query select true, v_used, -1;
  else
    return query select (v_used < v_quota), v_used, v_quota;
  end if;
end;
$$;

-- ---------- حدّ التخزين ----------
--
-- يُفحص قبل الرفع بحجم الملف القادم، لا بعده: الفحص البعدي يقبل ملفًا
-- يتجاوز الحدّ ثم يشكو، فيدفع العميل ثمن تخزين لم يشتره.
--
-- والوحدة ميغابايت لأن الخطة تُعرض بها، والتحويل هنا مرة واحدة بدل أن
-- يتكرر في كل موضع استدعاء.

create or replace function public.check_storage_quota(p_incoming_bytes bigint default 0)
returns table (allowed boolean, used_mb int, quota_mb int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_quota int;
  v_used_bytes bigint;
  v_used_mb int;
begin
  select company_id into v_company
  from public.profiles where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    return query select false, 0, 0;
    return;
  end if;

  v_quota := public.effective_plan_limit(v_company, 'max_storage_mb');

  select coalesce(sum(file_size_bytes), 0) into v_used_bytes
  from public.documents
  where company_id = v_company and status <> 'ARCHIVED';

  v_used_mb := ceil(v_used_bytes / 1048576.0)::int;

  if v_quota is null then
    return query select true, v_used_mb, -1;
  else
    return query select
      (ceil((v_used_bytes + greatest(coalesce(p_incoming_bytes, 0), 0)) / 1048576.0)::int <= v_quota),
      v_used_mb,
      v_quota;
  end if;
end;
$$;

-- ---------- الصلاحيات ----------

revoke all on function public.effective_plan_limit(uuid, text) from public, anon;
revoke all on function public.check_user_quota() from public, anon;
revoke all on function public.check_document_quota() from public, anon;
revoke all on function public.check_storage_quota(bigint) from public, anon;

grant execute on function public.check_user_quota() to authenticated;
grant execute on function public.check_document_quota() to authenticated;
grant execute on function public.check_storage_quota(bigint) to authenticated;

-- ═══════════════════════════════════════════════════════════
-- 0021_payments.sql
-- ═══════════════════════════════════════════════════════════
-- =====================================================================
-- 0021 — سجلّ المدفوعات وتفعيل الاشتراك
--
-- المبدأ الحاكم: لا شيء في هذا النظام يصدّق العميل في أمر الدفع.
-- المتصفح يُعاد إليه من البوابة بعنوان يحمل «نجح»، وذلك العنوان يمكن
-- كتابته يدويًا. فالحقيقة الوحيدة هي ما تقوله واجهة Moyasar حين نسألها
-- نحن من الخادم بمفتاحنا السري.
--
-- ولذلك يُخزَّن كل دفع هنا بمعرّفه لدى البوابة، ويُقيَّد بالشركة والخطة
-- والمبلغ الذي طُلب فعلًا — كي يُقارَن بما دُفع. ودفعُ ٤٩٩ لخطة ثمنها
-- ٩٩٩ يجب أن يُرفض، وهو ما لا يُكتشف إلا بحفظ المطلوب وقت الطلب.
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum ('INITIATED', 'PAID', 'FAILED', 'REFUNDED');
  end if;
end
$$;

create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  plan_id      uuid not null references public.plans(id) on delete restrict,
  initiated_by uuid references public.profiles(id) on delete set null,

  -- معرّف الدفع لدى البوابة. فريد كي لا يُحتسب النداء المكرر مرتين:
  -- البوابات تعيد إرسال الـwebhook عند أي شك في الوصول، وهذا متوقّع
  -- لا استثنائي.
  provider          text not null default 'moyasar',
  provider_payment_id text unique,

  -- المبلغ بالهللة كما تتعامل به Moyasar. عدد صحيح لا عشري: الحساب
  -- بالعشري يُدخل خطأ التقريب في المال، وهو آخر موضع يُحتمل فيه.
  amount_halalas int not null check (amount_halalas > 0),
  currency       text not null default 'SAR',

  status       public.payment_status not null default 'INITIATED',
  failure_reason text,

  -- نسخة كاملة من ردّ البوابة وقت التحقق — مرجع عند أي نزاع
  provider_payload jsonb,

  paid_at    timestamptz,
  -- لحظة تحويل هذه الدفعة إلى اشتراك. وجودها يمنع تطبيقها مرتين، وهو
  -- ما لا يكفي فيه فحصُ الحالة وحده: الحالة تبقى PAID بعد التطبيق.
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_company_idx
  on public.payments (company_id, created_at desc);
create index if not exists payments_status_idx
  on public.payments (status);

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;

-- يراها مدير الشركة وحده: الفاتورة شأن مالي لا يخصّ الموظفين.
-- ولا سياسة كتابة إطلاقًا — الإنشاء والتحديث بمفتاح الخدمة فقط، لأن
-- من يستطيع كتابة صفّ دفع يستطيع منح نفسه اشتراكًا.
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and (public.is_company_admin() or public.is_super_admin())
  );

grant select on public.payments to authenticated;

-- =====================================================================
-- تفعيل الاشتراك بعد دفعة مؤكَّدة
--
-- تُستدعى بمفتاح الخدمة بعد أن يكون الخادم قد سأل البوابة وتأكّد.
-- ولا تُمنح لأي دور آخر: هي الباب الذي يحوّل «دفع» إلى «اشتراك».
--
-- والدالة idempotent بحارس صريح لا بحسن النية: تُقفل صفّ الدفعة، وترفض
-- المضي إن كان applied_at مضبوطًا. فحصُ الحالة وحده لا يكفي — الحالة
-- تبقى PAID بعد التطبيق، فيمدّد النداء الثاني شهرًا بلا مقابل.
--
-- والنداء المكرر ليس احتمالًا نظريًا: الـwebhook يصل مرتين بحكم تصميم
-- البوابات، وقد يتزامن مع عودة المتصفح من صفحة الدفع. و FOR UPDATE
-- يحسم السباق بينهما بدل أن يمرّا معًا.
-- =====================================================================

create or replace function public.activate_subscription_for_payment(p_payment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_interval interval;
  v_base timestamptz;
begin
  -- القفل قبل القراءة: نداءان متزامنان يصطفّان بدل أن يقرآ الحالة نفسها
  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found or v_payment.status <> 'PAID' then
    return false;
  end if;

  -- طُبِّقت من قبل ⇒ لا شيء يُفعل، والإرجاع false كي لا يُفهَم تفعيلًا جديدًا
  if v_payment.applied_at is not null then
    return false;
  end if;

  select case when p.billing_interval = 'YEARLY' then interval '1 year'
              else interval '1 month' end
    into v_interval
  from public.plans p where p.id = v_payment.plan_id;

  -- التمديد من نهاية الفترة الحالية إن كانت قائمة، ومن الآن إن انقضت.
  -- الاحتساب من الآن دائمًا يبتلع ما تبقّى للعميل من أيام دفع ثمنها.
  select greatest(coalesce(s.current_period_end, now()), now())
    into v_base
  from public.subscriptions s
  where s.company_id = v_payment.company_id;

  v_base := coalesce(v_base, now());

  insert into public.subscriptions
    (company_id, plan_id, status, current_period_start, current_period_end)
  values
    (v_payment.company_id, v_payment.plan_id, 'ACTIVE', now(), v_base + v_interval)
  on conflict (company_id) do update
    set plan_id              = excluded.plan_id,
        status               = 'ACTIVE',
        current_period_start = now(),
        current_period_end   = excluded.current_period_end,
        canceled_at          = null;

  update public.payments set applied_at = now() where id = p_payment_id;

  return true;
end;
$$;

revoke all on function public.activate_subscription_for_payment(uuid) from public, anon, authenticated;
grant execute on function public.activate_subscription_for_payment(uuid) to service_role;

-- ═══════════════════════════════════════════════════════════
-- 0022_site_content.sql
-- ═══════════════════════════════════════════════════════════
-- =====================================================================
-- 0022 — محتوى الموقع القابل للتحرير
--
-- نصوص الموقع التعريفي كانت مكتوبة داخل الشيفرة، فتغيير كلمة يحتاج
-- مطوّرًا ونشرًا. وصاحبة المنتج أدرى بصياغة عرضها من أي أحد، فبقاء
-- النصّ حبيس الشيفرة يجعل أهمّ ما في الموقع أبطأ ما فيه تغييرًا.
--
-- والتصميم هنا **تجاوزات لا مصدر**: يبقى النصّ الأصلي في الشيفرة قيمةً
-- افتراضية، ويحمل هذا الجدول ما غُيِّر منه فقط. ولذلك ثلاث فوائد:
--
--   • جدول فارغ = الموقع كما هو. فلا يتوقف على ترحيل ولا على بيانات.
--   • حذف صفّ = عودة إلى النصّ الأصلي، بلا حاجة إلى تذكّره.
--   • مفتاح لم يعد مستعملًا في الشيفرة يُهمَل بلا ضرر.
--
-- ولا يُخزَّن هنا إلا نصّ يُعرض للعامة — لا أسرار ولا بيانات شركات.
-- =====================================================================

create table if not exists public.site_content (
  -- مفتاح ثابت يشير إليه الكود، مثل: home.hero.title
  key        text primary key,
  value      text not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint site_content_key_format check (key ~ '^[a-z0-9]+(\.[a-z0-9_]+)+$'),
  constraint site_content_value_length check (length(value) <= 5000)
);

drop trigger if exists site_content_set_updated_at on public.site_content;
create trigger site_content_set_updated_at
  before update on public.site_content
  for each row execute function public.set_updated_at();

alter table public.site_content enable row level security;

-- يقرؤه الجميع بلا استثناء: هذا نصّ صفحة عامة، والزائر غير المسجّل هو
-- قارئه الأول. ولا معنى لحجب ما يُعرض على الصفحة نفسها.
drop policy if exists site_content_read on public.site_content;
create policy site_content_read on public.site_content
  for select to anon, authenticated
  using (true);

-- ولا سياسة كتابة لأي دور: التحرير يمرّ بمفتاح الخدمة بعد التحقق من أن
-- المُحرِّر مالك المنصة. محتوى الصفحة الرئيسية سطحُ عرضٍ عام، ومن يكتب
-- فيه يكتب على واجهة المنصة كلها.
grant select on public.site_content to anon, authenticated;

-- ═══════════════════════════════════════════════════════════
-- 0023_site_content_long_values.sql
-- ═══════════════════════════════════════════════════════════
-- =====================================================================
-- 0023 — توسيع حدّ طول محتوى الموقع
--
-- وُضع الحدّ في 0022 عند 5000 محرف حين كان المحرَّر عناوين وفقرات
-- مفردة. ثم صار المحتوى المتكرّر — بطاقات المميزات والأسئلة الشائعة —
-- يُحرَّر أيضًا، وهو يُخزَّن قائمةً مُسلسَلة في صفّ واحد. وقائمة الأسئلة
-- وحدها تتجاوز 5000 محرف بأجوبتها.
--
-- والنتيجة لو بقي الحدّ: تحرير سؤال واحد يفشل عند الحفظ برسالة عن طول
-- لا تراه المحرِّرة ولا تفهم مصدره، لأن ما تراه حقلٌ صغير لا صفّ كامل.
--
-- والحدّ الجديد 200000 محرف. ووجودُ حدٍّ أصلًا مقصود: الحقل يُكتب بمفتاح
-- الخدمة، وصفٌّ بلا سقف يجعل خطأً واحدًا في حلقة قادرًا على ملء الجدول.
-- =====================================================================

alter table public.site_content
  drop constraint if exists site_content_value_length;

alter table public.site_content
  add constraint site_content_value_length check (length(value) <= 200000);

-- ═══════════════════════════════════════════════════════════
-- 0024_site_pages.sql
-- ═══════════════════════════════════════════════════════════
-- =====================================================================
-- 0024 — صفحات يصنعها مالك المنصة
--
-- محرِّر المحتوى (0022) يغيّر نصوص صفحات موجودة، ولا يصنع صفحة جديدة.
-- وما يُطلب فعلًا بعد الإطلاق صفحةٌ لم تكن في الحسبان: «سياسة الاسترجاع»،
-- «للشركاء»، «حالة الخدمة»، صفحة حملة تسويقية. وانتظارُ مطوّر لكل واحدة
-- يجعل أسرع ما يتغيّر في العمل أبطأ ما في المنتج.
--
-- والمسار `/p/<الاسم>` بادئة مقصودة: تفصل ما يصنعه المالك عن مسارات
-- التطبيق فصلًا تامًّا. ولولاها لَاستطاع اسمُ صفحةٍ أن يحجب `/login` أو
-- `/documents` — وهو عطلٌ يصنعه من لا يعرف أنه يصنعه.
--
-- ولا يُخزَّن هنا إلا محتوى معروض للعامة.
-- =====================================================================

create table if not exists public.site_pages (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  description  text,
  body         text not null default '',
  status       text not null default 'DRAFT',
  show_in_nav  boolean not null default false,
  sort_order   integer not null default 0,
  updated_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint site_pages_status_check check (status in ('DRAFT', 'PUBLISHED')),

  -- لا مسافة ولا محرف يغيّر معنى المسار. والصيغة تقبل العربية عمدًا:
  -- من يكتب صفحة عربية يسمّيها بالعربية، وفرضُ اسم لاتيني عليه ضريبةٌ
  -- بلا مقابل. والمتصفحات تعرض العربية في المسار مقروءةً منذ سنين.
  constraint site_pages_slug_format check (slug ~ '^[^[:space:]/?#%&.]{2,60}$'),
  constraint site_pages_title_length check (length(title) between 1 and 200),
  constraint site_pages_description_length check (description is null or length(description) <= 500),
  constraint site_pages_body_length check (length(body) <= 200000)
);

create index if not exists site_pages_nav_idx
  on public.site_pages (sort_order, created_at)
  where status = 'PUBLISHED' and show_in_nav;

drop trigger if exists site_pages_set_updated_at on public.site_pages;
create trigger site_pages_set_updated_at
  before update on public.site_pages
  for each row execute function public.set_updated_at();

alter table public.site_pages enable row level security;

-- المنشور وحده يُقرأ، والمسوَّدة لا يراها أحد عبر هذه السياسة — ولا حتى
-- مالك المنصة. لأن اللوحة تقرأ بمفتاح الخدمة أصلًا، وتوسيعُ السياسة
-- لأجلها يفتح المسوَّدات على مسار لا يحتاجها.
drop policy if exists site_pages_read_published on public.site_pages;
create policy site_pages_read_published on public.site_pages
  for select to anon, authenticated
  using (status = 'PUBLISHED');

-- ولا سياسة كتابة لأي دور: الإنشاء والتعديل يمرّان بمفتاح الخدمة بعد
-- التحقق من أن الفاعل مالك المنصة. من يكتب صفحة عامة يكتب على واجهة
-- المنصة كلها، فلا تُترك هذه لسياسة تُقرأ بسرعة يومًا ما.
grant select on public.site_pages to anon, authenticated;

-- ═══════════════════════════════════════════════════════════
-- 0025_plan_repricing.sql
-- ═══════════════════════════════════════════════════════════
-- =====================================================================
-- 0025 — إعادة تسعير الخطط
--
-- التسعير الأول كان يخسر. الحساب:
--
--   النموذج الافتراضي `claude-opus-5` بسقف خرج 8000 ⇒ السؤال ≈ 0.068$
--   وخطة Starter تبيع 5000 سؤال بـ499 ريالًا (133$) ⇒ التكلفة 340$
--
-- أي أن **العميل الأكثر استعمالًا هو الأكثر خسارةً** — وهو انقلابٌ في
-- نموذج العمل لا مسألة تحسين. ورفعُ السعر بعد توقيع العقود أصعب بكثير
-- من ضبطه قبلها، فالتصحيح يسبق أول عميل لا يتبعه.
--
-- وثلاثة تغييرات معًا:
--
--   1. الأسعار ترتفع إلى ~80 ريالًا لكل مستخدم. والعشرة ريالات السابقة
--      لا تُقرأ كرمًا بل شكًّا في القيمة: منافسنا يبيع بـ20–75 دولارًا.
--
--   2. الحصص تنكمش إلى ما يُبلَغ فعلًا (60–80 سؤالًا للموظف شهريًا =
--      3–4 يوميًا). والحصة التي لا تُبلَغ أبدًا لا تبيع ترقية، وهي كل
--      فائدة وجودها.
--
--   3. تُضاف خطة وسطى (Growth) — والقفزة من 899 إلى 5999 مباشرةً تترك
--      الشركة المتوسطة بلا ما يناسبها.
--
-- وحدّ المستندات ليس لتغطية تكلفة: فهرسة المستند تكلّف 0.0007$ فقط.
-- وجوده لتقسيم الخطط وإعطاء سببٍ للترقية.
--
-- والتحديث بالرمز (code) لا بالمعرّف، وبـupdate لا بحذفٍ وإنشاء: الخطة
-- المحذوفة تكسر كل اشتراك يشير إليها.
-- =====================================================================

update public.plans set
  price_amount          = 899.00,
  description           = 'للفرق الصغيرة التي تبدأ توثيق معرفتها.',
  max_users             = 10,
  max_documents         = 50,
  max_questions_monthly = 600,
  max_storage_mb        = 5120,
  features = '["مساعد ذكي بالعربية والإنجليزية","إجابات موثّقة بالمصدر والصفحة","التحقق من الأرقام ودرجة الثقة","فجوات المعرفة","صلاحيات على مستوى المستند","سجل تدقيق","دعم عبر البريد خلال يوم عمل"]'::jsonb,
  sort_order = 1
where code = 'STARTER';

insert into public.plans
  (code, name, description, price_amount, currency, billing_interval,
   max_users, max_documents, max_questions_monthly, max_storage_mb,
   features, is_public, is_custom_priced, sort_order)
values
  ('GROWTH', 'Growth',
   'الأنسب للشركات التي يسأل فريقها يوميًا.',
   2499.00, 'SAR', 'MONTHLY',
   30, 200, 2000, 25600,
   '["كل مزايا Starter","تحليلات متقدمة والنشاط حسب القسم","مساعد واتساب","أولوية في الدعم خلال 4 ساعات","تقارير جودة الإجابات"]'::jsonb,
   true, false, 2)
on conflict (code) do update set
  name                  = excluded.name,
  description           = excluded.description,
  price_amount          = excluded.price_amount,
  max_users             = excluded.max_users,
  max_documents         = excluded.max_documents,
  max_questions_monthly = excluded.max_questions_monthly,
  max_storage_mb        = excluded.max_storage_mb,
  features              = excluded.features,
  is_public             = excluded.is_public,
  sort_order            = excluded.sort_order;

update public.plans set
  price_amount          = 5999.00,
  description           = 'للمؤسسات التي تحتاج ضوابط وصولٍ ومستوى خدمة.',
  max_users             = 75,
  max_documents         = 600,
  max_questions_monthly = 6000,
  max_storage_mb        = 102400,
  features = '["كل مزايا Growth","الدخول الموحّد (SSO)","تقرير عزل موقّع لفريق الأمن","اتفاقية مستوى خدمة 99.5%","مدير حساب مخصّص"]'::jsonb,
  sort_order = 3
where code = 'BUSINESS';

update public.plans set
  description = 'للمؤسسات الكبيرة ذات المتطلبات الخاصة.',
  features = '["كل مزايا Business","عدد مستخدمين غير محدود","مفتاح ذكاء اصطناعي خاص بالعميل (BYOK)","تكاملات مخصصة","خيارات استضافة خاصة"]'::jsonb,
  sort_order = 4
where code = 'ENTERPRISE';

-- ═══════════════════════════════════════════════════════════
-- 0026_quota_warning.sql
-- ═══════════════════════════════════════════════════════════
-- =====================================================================
-- 0026 — تنبيه اقتراب الحصة
--
-- النوع `QUOTA_WARNING` معرَّف في 0014 منذ البداية، ولم يُرسَل قطّ.
-- أي أن المنصة تحمل ميزةً موجودةً شكلًا لا تعمل — وهو أسوأ من غيابها:
-- من يقرأ قائمة الأنواع يظنّ التنبيه يصل، فلا يبحث عن سببٍ لعدم وصوله.
--
-- والأثر التجاري لا الأمني هو المقصود هنا: العميل الذي يُفاجأ بتوقّف
-- الأسئلة يغضب ويفتح تذكرة دعم. والعميل الذي يُنبَّه عند 80٪ يرقّي
-- خطته — وهي كل فائدة وجود الحصة أصلًا.
--
-- **يُرسَل مرة واحدة لكل شهر ولكل مدير.** والتكرار هنا احتمالٌ حقيقي:
-- الدالة تُستدعى بعد **كل سؤال**، فبعد بلوغ 80٪ يبقى الشرط صادقًا في
-- كل سؤال تالٍ. ومعرّف الكيان يُشتقّ من (الشركة + الشهر) اشتقاقًا
-- ثابتًا، فيصير الفهرس الفريد (user_id, type, entity_id) هو الذي يمنع
-- التكرار — لا شرطٌ في الشيفرة يُنسى.
-- =====================================================================

create or replace function public.notify_quota_warning()
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_quota   int;
  v_used    int;
  v_entity  uuid;
  v_percent int;
begin
  select company_id into v_company
  from public.profiles
  where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    return;
  end if;

  -- الحصة والاستهلاك — نفس مصدر check_question_quota
  select coalesce(
           nullif(s.limit_overrides ->> 'max_questions_monthly', '')::int,
           p.max_questions_monthly
         )
    into v_quota
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.company_id = v_company;

  -- خطة بلا حدّ للأسئلة: لا شيء يُنبَّه عنه
  if v_quota is null or v_quota <= 0 then
    return;
  end if;

  select coalesce(u.questions_count, 0) into v_used
  from public.usage_records u
  where u.company_id = v_company
    and u.period_month = date_trunc('month', now())::date;

  v_used := coalesce(v_used, 0);
  v_percent := (v_used * 100) / v_quota;

  -- دون 80٪ لا تنبيه. وفوق الحصة تتوقف الأسئلة برسالتها الخاصة،
  -- فتنبيهُ «اقتربتِ» بعد النفاد يصل متأخرًا ويقرأ استهزاءً.
  if v_percent < 80 or v_used >= v_quota then
    return;
  end if;

  -- معرّف ثابت لكل (شركة + شهر) — هو ما يمنع التكرار عبر الفهرس الفريد
  v_entity := md5(v_company::text || ':quota:' || to_char(now(), 'YYYY-MM'))::uuid;

  insert into public.notifications
    (company_id, user_id, type, title, body, link, entity_type, entity_id)
  select
    v_company,
    pr.id,
    'QUOTA_WARNING',
    'اقترب حدّ الأسئلة الشهري',
    'استُهلك ' || v_percent || '٪ من حصة هذا الشهر (' || v_used || ' من ' || v_quota ||
      ' سؤال). عند بلوغ الحدّ تتوقف الأسئلة الجديدة حتى بداية الشهر القادم أو ترقية الخطة.',
    '/settings/billing',
    'subscription',
    v_entity
  from public.profiles pr
  where pr.company_id = v_company
    and pr.role = 'COMPANY_ADMIN'
    and pr.status = 'ACTIVE'
  on conflict (user_id, type, entity_id) do nothing;
end;
$$;

comment on function public.notify_quota_warning() is
  'ينبّه مديري الشركة عند بلوغ 80٪ من حصة الأسئلة — مرة واحدة لكل شهر.';

grant execute on function public.notify_quota_warning() to authenticated;

