-- =====================================================================
-- 0043 — تتبّع مصدر المرجع النظامي
--
-- العطل: رابط المصدر يُكتب عند رفع الوثيقة المرجعية، ويُخزَّن، ويُعرض
-- في صفحة إدارة المكتبة — **ثم يتوقف هناك**. فدالّة البحث لا تُرجعه،
-- فلا يصل استوديو السياسات، فلا يراه المدير أسفل المسوّدة.
--
-- والنتيجة أن أخطر استشهاد في المنتج — الاستشهاد النظاميّ — هو الوحيد
-- الذي لا يملك قارئه طريقًا للتحقق منه. وهذا يناقض أساس المنتج: كل
-- إجابة بمصدرها.
--
-- ويُضاف معه **تاريخ نسخ النصّ**، وهو لا يقلّ أهمية عن الرابط: النصّ
-- النظاميّ يتغيّر. فسياسةٌ اعتُمدت استنادًا إلى مادة عُدّلت بعدها تبدو
-- صحيحة إلى الأبد ما لم يُقل متى نُسخ نصّها.
-- =====================================================================

-- ---------- تاريخ نسخ النصّ ----------
--
-- منفصل عن `created_at` عن قصد: الصفّ قد يُعاد رفعه بنصّ محدَّث لاحقًا،
-- فيتغيّر تاريخ النسخ ويبقى تاريخ الإنشاء. وهما سؤالان مختلفان:
-- «متى أُضيف هذا المرجع؟» و«متى نُسخ النصّ الذي أستشهد به؟».

alter table public.platform_reference_documents
  add column if not exists text_copied_at timestamptz not null default now();

comment on column public.platform_reference_documents.text_copied_at is
  'متى نُسخ النصّ من مصدره الرسمي — يُعرض مع كل استشهاد كي يعرف المراجع '
  'إلى أي لحظة يعود النصّ، فالنظام يتغيّر والاستشهاد لا يُحدِّث نفسه.';

-- ---------- دالّة البحث تُرجع المصدر وتاريخه ----------
--
-- التغيير عمودان في قائمة الإرجاع. ولا يُمسّ شيء آخر: لا شرط البحث،
-- ولا حدّ التشابه، ولا الترتيب، ولا اشتراط `READY`. والدالّة تبقى
-- `security definer` تحرس حالة النشر بنفسها كما كانت.

-- تغيير قائمة الإرجاع يوجب الحذف أولًا: PostgreSQL لا يسمح بتبديل نوع
-- العائد بـ`create or replace`. والحذف آمن هنا — الدالّة تُعاد إنشاؤها
-- في الجملة التالية داخل الترحيلة نفسها.
drop function if exists public.match_platform_reference_chunks(vector, int, float);

create function public.match_platform_reference_chunks(
  p_query_embedding vector(1024),
  p_match_count int default 6,
  p_min_similarity float default 0.3
)
returns table (
  chunk_id       uuid,
  document_id    uuid,
  document_name  text,
  authority      text,
  reference_code text,
  source_url     text,
  text_copied_at timestamptz,
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
  select c.id, d.id, d.name, d.authority, d.reference_code,
         d.source_url, d.text_copied_at,
         c.content, c.page_number, c.section_title,
         1 - (c.embedding <=> p_query_embedding) as similarity
  from public.platform_reference_chunks c
  join public.platform_reference_documents d on d.id = c.document_id
  where d.status = 'READY' and c.embedding is not null
    and 1 - (c.embedding <=> p_query_embedding) >= p_min_similarity
  order by c.embedding <=> p_query_embedding
  limit greatest(1, least(coalesce(p_match_count, 6), 20));
$$;

revoke all on function public.match_platform_reference_chunks(vector, int, float) from public;
grant execute on function public.match_platform_reference_chunks(vector, int, float) to authenticated;
