-- =====================================================================
-- فحص حالة القاعدة — ما المطبَّق وما الناقص
-- =====================================================================
-- يُلصق في محرّر SQL على Supabase. آمن تمامًا: يقرأ ولا يكتب شيئًا.
--
-- ولماذا يوجد هذا الملف أصلًا: الترحيلات تُطبَّق يدويًا على الإنتاج،
-- فيقع أن تُطبَّق واحدةٌ وتُنسى التي بعدها. ولا يظهر ذلك خطأً في
-- الواجهة إلا عند فتح الصفحة التي تحتاجها — بعد أسابيع أحيانًا.
--
-- أُثبت في الحالتين: على قاعدة عند 0031 يقول «ناقص» في الأربعة الأولى،
-- وعلى قاعدة طُبِّق عليها 0032 و0033 يقول «مطبَّق» فيها كلها.
-- =====================================================================
with
tsv as (
  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='document_chunks'
      and column_name='content_tsv'
  ) as ok
),
fn as (
  -- المطابقة بالاسم لا بالتوقيع: التوقيع يتغيّر بتغيّر نوعٍ واحد
  -- (real مقابل double precision) فيقول «ناقص» عن دالّة موجودة.
  select p.proname as name
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
)
select 1 as "#", 'البحث الهجين — الدالّة (0032)' as "البند",
  case when exists (select 1 from fn where name='match_document_chunks_hybrid')
       then '✅ مطبَّق' else '❌ ناقص' end as "الحالة"
union all select 2, 'البحث الهجين — عمود content_tsv (0032)',
  case when (select ok from tsv) then '✅ مطبَّق' else '❌ ناقص' end
union all select 3, 'قياس الرضا (0033)',
  case when exists (select 1 from fn where name='platform_satisfaction')
       then '✅ مطبَّق' else '❌ ناقص' end
union all select 4, 'أسباب عدم الرضا (0033)',
  case when exists (select 1 from fn where name='platform_feedback_notes')
       then '✅ مطبَّق' else '❌ ناقص' end
union all select 5, 'مقاطع بلا متجه (المطلوب: صفر)',
  (select count(*)::text from public.document_chunks where embedding is null)
union all select 6, 'مقاطع بلا فهرس لفظيّ (المطلوب: صفر)',
  case when (select ok from tsv) then
    (xpath('/row/c/text()', query_to_xml(
      'select count(*) as c from public.document_chunks where content_tsv is null',
      false, true, '')))[1]::text
  else 'لا ينطبق — العمود ناقص' end
union all select 7, 'أرضية التشابه (المطلوب: 0.05)',
  coalesce((select string_agg(distinct coalesce(ai_settings->>'min_similarity','(غائبة)'), ' · ')
            from public.companies), '(لا شركات بعد)')
order by 1;
