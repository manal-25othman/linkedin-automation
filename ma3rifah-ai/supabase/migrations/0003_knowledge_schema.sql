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
