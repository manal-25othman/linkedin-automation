-- =====================================================================
-- جودة الفهرسة — عين مالك المنصّة على عطب النصّ العربي
-- =====================================================================
-- عطب لام-ألف يفسد الفهرس بصمت: الرفع ينجح، والحالة «جاهز»، والمساعد
-- يقول «لم أجد» عن نصّ موجود. وكان كشفه يدويًا — استعلامًا يُلصق في
-- محرّر SQL كلما ساور الشكّ أحدًا. والفحص الذي يحتاج أن تتذكّره لا
-- يعمل يوم تنساه.
--
-- فتُحصى المقاطع المشبوهة لكل شركة وتُعرض في لوحة إدارة المنصّة:
-- صفٌّ غير صفريّ يظهر قبل أن يشتكي عميل.
--
-- خصوصية: **أعداد فقط**. لا محتوى مقاطع، ولا أسماء مستندات — اسم
-- مستند عميلٍ قد يكون بنفسه معلومة («رواتب الإدارة التنفيذية»).
-- والنمط هنا يطابق قائمة الإصلاح في src/lib/rag/extract.ts — وحارس
-- في اختبارات الوحدة يمنع افتراقهما.
create or replace function public.platform_index_quality()
returns table (
  company_name    text,
  chunks_total    bigint,
  chunks_flagged  bigint,
  documents_flagged bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  -- كلمات القائمة المُنسَّقة — الجانب المعطوب منها
  v_curated constant text :=
    'خالل|الالئح|هؤالء|أوالد|البالد|الالزم|الالحق|إبالغ|لألجور|لالحتساب|لإلجراء|لإلدارة|لإلشراف|ثالثين|ثالثون';
begin
  if not public.is_super_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  return query
  select
    co.name,
    count(c.id),
    count(c.id) filter (where
         c.content ~ '[آأإا][آأإا]ل'
      or c.content ~ '(^|[^ء-ي])ال([^ء-ي]|$)'
      or c.content ~ v_curated
    ),
    count(distinct c.document_id) filter (where
         c.content ~ '[آأإا][آأإا]ل'
      or c.content ~ '(^|[^ء-ي])ال([^ء-ي]|$)'
      or c.content ~ v_curated
    )
  from public.companies co
  join public.document_chunks c on c.company_id = co.id
  group by co.id, co.name
  order by 3 desc, co.name;
end;
$$;

revoke all on function public.platform_index_quality() from public, anon;
grant execute on function public.platform_index_quality() to authenticated;
