-- =====================================================================
-- 0039 — المكتبة المرجعية الرسمية: أساس استوديو السياسات
-- =====================================================================
-- ما تحلّه:
--
-- الشركة التي **لا لوائح لديها** لا تستطيع شراء بديهة اليوم: المنتج
-- يجيب من وثائقها، ولا وثائق عندها. وهي ليست حالة نادرة — كثير من
-- المنشآت المتوسطة تدير الموارد البشرية بالعُرف وذاكرة المدير.
--
-- واستوديو السياسات يقلب هذا الاستبعاد: يكتب مسوّدة سياسة مستندة إلى
-- وثائق الشركة **ومكتبة مرجعية رسمية** (نظام العمل ولوائحه)، يحرّرها
-- المدير ويعتمدها فتدخل قاعدة المعرفة. والمكتبة هذه هي ما تبنيه هذه
-- الهجرة — الطبقة الأولى من ثلاث.
--
-- ---------------------------------------------------------------------
-- لماذا جدولان منفصلان لا وسمٌ على `documents`
-- ---------------------------------------------------------------------
-- الوسم كان أقصر: عمود `is_platform_reference` على `documents`، وشرطٌ
-- يُضاف إلى `can_read_document`. وهو الطريق الخطأ.
--
-- لأن `can_read_document` هي البوابة التي يقوم عليها عزل العملاء كله،
-- وتقرؤها سياساتُ جداول كثيرة ودالّة الاسترجاع. وكل شرط يُضاف في
-- صدرها يوسّع سطح ما يجب أن يُحرس، ويصير سطرًا واحدًا خاطئًا كافيًا
-- لتسريب وثيقة شركة إلى أخرى.
--
-- والمواصفة تشترط صراحةً أن **لا تدخل المكتبةُ نتائجَ بحث المساعد
-- العادي** — كي لا يظنّ الموظف أن نظام العمل لائحةُ شركته. والوسم
-- يجعل ذلك مرشِّحًا يُنسى؛ والجدول المنفصل يجعله **بنية لا خيارًا**:
-- دالّة الاسترجاع الحالية لا تعرف هذا الجدول أصلًا.
--
-- فلا سطر واحد هنا يمسّ `documents` ولا `document_chunks` ولا
-- `can_read_document` ولا `match_chunks_for_user`. عزل العملاء اليوم
-- هو نفسه بعد هذه الهجرة حرفًا بحرف.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ١) الوثائق المرجعية
-- ---------------------------------------------------------------------
-- بلا `company_id` عمدًا: هذه لا تخصّ شركة، ووجود العمود كان سيغري
-- بربطها بشركة المالكة فتتسرّب إلى بحثها هي.

create table if not exists public.platform_reference_documents (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  -- الجهة المُصدِرة ورقم المرجع: يظهران في الاستشهاد داخل المسوّدة،
  -- فالمواصفة تشترط استشهادًا إلزاميًا لكل جملة تنظيمية.
  authority       text not null,
  reference_code  text,
  source_url      text,
  description     text,
  file_type       text not null default 'text/plain',
  file_size_bytes bigint not null default 0,
  status          public.document_status not null default 'PROCESSING',
  error_message   text,
  uploaded_by     uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint platform_reference_documents_name_not_blank
    check (length(btrim(name)) > 0),
  constraint platform_reference_documents_authority_not_blank
    check (length(btrim(authority)) > 0)
);

-- ---------------------------------------------------------------------
-- ٢) مقاطع الوثائق المرجعية
-- ---------------------------------------------------------------------

create table if not exists public.platform_reference_chunks (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null
                  references public.platform_reference_documents(id)
                  on delete cascade,
  chunk_index   int not null,
  content       text not null,
  token_count   int not null default 0,
  page_number   int,
  section_title text,
  embedding     vector(1024),
  created_at    timestamptz not null default now(),
  constraint platform_reference_chunks_unique_index
    unique (document_id, chunk_index),
  constraint platform_reference_chunks_content_not_blank
    check (length(btrim(content)) > 0)
);

create index if not exists platform_reference_chunks_document_idx
  on public.platform_reference_chunks (document_id, chunk_index);

create index if not exists platform_reference_chunks_embedding_idx
  on public.platform_reference_chunks
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- ---------------------------------------------------------------------
-- ٣) الصلاحيات: يقرؤها الجميع، ولا يكتبها إلا مالك المنصّة
-- ---------------------------------------------------------------------
-- استثناء مقصود ومحدود ومحروس: القراءة مفتوحة لأن النصّ نظامٌ عامّ
-- منشور، ولا شيء فيه يخصّ شركةً بعينها. والكتابة محصورة في المالكة
-- لأن نصًّا تنظيميًّا خاطئًا يصير سياسةَ شركةٍ مُعتمدة.

alter table public.platform_reference_documents enable row level security;
alter table public.platform_reference_chunks    enable row level security;

drop policy if exists platform_reference_documents_select
  on public.platform_reference_documents;
create policy platform_reference_documents_select
  on public.platform_reference_documents
  for select to authenticated
  using (status = 'READY');

drop policy if exists platform_reference_documents_write
  on public.platform_reference_documents;
create policy platform_reference_documents_write
  on public.platform_reference_documents
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists platform_reference_chunks_select
  on public.platform_reference_chunks;
create policy platform_reference_chunks_select
  on public.platform_reference_chunks
  for select to authenticated
  using (
    exists (
      select 1
      from public.platform_reference_documents d
      where d.id = platform_reference_chunks.document_id
        and d.status = 'READY'
    )
  );

drop policy if exists platform_reference_chunks_write
  on public.platform_reference_chunks;
create policy platform_reference_chunks_write
  on public.platform_reference_chunks
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- المنح على مستوى الجدول: سياسات RLS تُصفّي الصفوف، والمنح يفتح
-- الباب أصلًا. والكتابة ممنوحة لأن `is_super_admin()` في السياسة هي
-- الحارس الفعلي — ولولا المنح لَما استطاعت المالكة الرفع أصلًا.

grant select, insert, update, delete
  on public.platform_reference_documents to authenticated;
grant select, insert, update, delete
  on public.platform_reference_chunks to authenticated;

-- ---------------------------------------------------------------------
-- ٤) الاسترجاع من المكتبة — دالّة مستقلّة لا تمسّ استرجاع الشركات
-- ---------------------------------------------------------------------
-- تُنادى من استوديو السياسات وحده. والمساعد العادي لا يعرفها، فلا
-- يمكن أن يخلط نظامَ العمل بلائحة الشركة ولو أخطأ أحدٌ في موجّه.
--
-- وكل صفّ يعود موسومًا بجهته ورقم مرجعه: المواصفة تحذف أي جملة
-- تنظيمية بلا مصدر قبل عرض المسوّدة، وهذه هي المادة التي تُبنى منها
-- تلك الاستشهادات.

create or replace function public.match_platform_reference_chunks(
  p_query_embedding vector(1024),
  p_match_count     int default 6,
  p_min_similarity  float default 0.3
)
returns table (
  chunk_id       uuid,
  document_id    uuid,
  document_name  text,
  authority      text,
  reference_code text,
  content        text,
  page_number    int,
  section_title  text,
  similarity     float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    d.id,
    d.name,
    d.authority,
    d.reference_code,
    c.content,
    c.page_number,
    c.section_title,
    1 - (c.embedding <=> p_query_embedding) as similarity
  from public.platform_reference_chunks c
  join public.platform_reference_documents d on d.id = c.document_id
  where d.status = 'READY'
    and c.embedding is not null
    and 1 - (c.embedding <=> p_query_embedding) >= p_min_similarity
  order by c.embedding <=> p_query_embedding
  limit greatest(1, least(coalesce(p_match_count, 6), 20));
$$;

revoke all on function public.match_platform_reference_chunks(vector, int, float)
  from public;
grant execute on function public.match_platform_reference_chunks(vector, int, float)
  to authenticated;

comment on table public.platform_reference_documents is
  'وثائق نظامية عامة ترفعها مالكة المنصّة وتقرؤها كل الشركات قراءةً فقط. '
  'منفصلة عن documents عمدًا كي لا تدخل استرجاع المساعد العادي.';
