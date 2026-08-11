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

