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
