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
