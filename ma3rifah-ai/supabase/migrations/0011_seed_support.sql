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
