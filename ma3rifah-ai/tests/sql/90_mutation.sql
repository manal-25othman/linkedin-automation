-- =====================================================================
-- شاهد سلبي (Mutation testing)
--
-- يزرع ثغرة حقيقية بتعطيل حرّاس العزل، ثم تُشغَّل الاختبارات نفسها.
-- الاختبار الذي لا يفشل هنا اختبار بلا قيمة: نجاحه في الحالة السليمة
-- قد يكون مصادفة. يُشغَّل عبر: MUTATE=1 ./tests/sql/run-isolation-tests.sh
--
-- لا يُطبَّق هذا الملف أبدًا على قاعدة إنتاج.
-- =====================================================================

-- (1) تعطيل حارس انتماء الصف للشركة، وحارس صلاحية قراءة المستند —
--     تعتمد عليهما كل سياسات RLS تقريبًا.

create or replace function public.belongs_to_current_company(p_company_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select true $$;

create or replace function public.can_read_document(
  p_company_id uuid,
  p_visibility public.document_visibility,
  p_allowed_department_ids uuid[],
  p_allowed_roles public.user_role[]
) returns boolean language sql stable security definer set search_path = public
as $$ select true $$;

-- (2) نزع فلاتر الشركة والصلاحيات من دالة الاسترجاع الدلالي نفسها،
--     مع إبقاء بقية سلوكها كما هو — لاختبار مسار RAG تحديدًا.

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
language plpgsql stable security definer set search_path = public
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

  p_match_count := least(greatest(coalesce(p_match_count, 8), 1), 20);

  return query
  select c.id, d.id, d.name, d.category_id, c.content, c.page_number, c.section_title,
         (1 - (c.embedding <=> p_query_embedding))::real
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where true                      -- ⚠ كان: c.company_id = v_company
    and true                      -- ⚠ كان: d.company_id = v_company
    and d.status = 'READY'
    and true                      -- ⚠ كانت: شروط visibility والدور والقسم
    and (p_category_ids is null or d.category_id = any (p_category_ids))
    and (1 - (c.embedding <=> p_query_embedding)) >= coalesce(p_min_similarity, 0.30)
  order by c.embedding <=> p_query_embedding
  limit p_match_count;
end;
$$;

-- (٦) فتح جدول الصفحات المقروءة ضوئيًا للمستخدمين — يجب أن يسقط اختبار
--     «مدير الشركة لا يقرأ جدول الصفحات المقروءة مباشرة».
grant select on public.document_ocr_pages to authenticated;
create policy mutation_open_ocr_pages on public.document_ocr_pages
  for select to authenticated using (true);
