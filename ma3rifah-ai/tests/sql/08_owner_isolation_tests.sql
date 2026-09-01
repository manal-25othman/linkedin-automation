-- =====================================================================
-- المجموعة ٩ — عزل المالك (0035)
-- =====================================================================
-- اكتشفته المالكة في الإنتاج: ملف شركةٍ عميلة ظهر في قائمتها. كانت
-- `can_read_document` و`belongs_to_current_company` تفتحان لدور
-- SUPER_ADMIN كل الشركات. والوثيقة تعِد: «مالك المنصّة لا يقرأ محتوى
-- وثائق العملاء».
--
-- العقد بعد 0035: المالك بلا شركة لا يقرأ شيئًا، والمربوط بشركةٍ
-- (مساحته الخاصة) يقرأ مساحته وحدها.

-- ── الحالة ١: المالك مربوط بمساحته (حالة الإنتاج) ──
update public.profiles set company_id = '11111111-1111-1111-1111-111111111111'
where id = '00000000-2000-4000-8000-000000000001';

-- العدد الحقيقي لمستندات مساحته — يُقاس قبل تقمّص الدور، فتُقارن رؤيته
-- به بالتساوي: أقل منه حجبٌ زائد، وأكثر منه تسريب
create temp table owner_expected as
select count(*) as n from public.documents
where company_id = '11111111-1111-1111-1111-111111111111';
grant select on owner_expected to authenticated;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-2000-4000-8000-000000000001', true);

insert into public.test_results (category, name, passed, detail)
select 'عزل المالك', 'المالك يرى مستندات مساحته كلها — لا أقل ولا أكثر (ضابط موجب)',
       count(*) = (select n from owner_expected) and count(*) >= 1,
       'رأى=' || count(*) || ' من ' || (select n from owner_expected)
from public.documents
where company_id = '11111111-1111-1111-1111-111111111111';

insert into public.test_results (category, name, passed, detail)
select 'عزل المالك', 'مستند الشركة العميلة لا يظهر للمالك',
       count(*) = 0, 'رأى=' || count(*)
from public.documents
where id = 'bbbbbbbb-3000-4000-8000-000000000001';

insert into public.test_results (category, name, passed, detail)
select 'عزل المالك', 'مقاطع الشركة العميلة لا تظهر للمالك',
       count(*) = 0, 'رأى=' || count(*)
from public.document_chunks
where document_id = 'bbbbbbbb-3000-4000-8000-000000000001';

insert into public.test_results (category, name, passed, detail)
select 'عزل المالك', 'استرجاع المالك لا يصل وثائق العملاء',
       count(*) = 0, 'تسرّب=' || count(*)
from public.match_document_chunks_hybrid(
  (select ('[' || string_agg('0.1', ',') || ']')::vector
   from generate_series(1, 1024)),
  'عقود عملاء', 20, 0.0, null)
where document_id = 'bbbbbbbb-3000-4000-8000-000000000001';

commit;

-- ── الحالة ٢: المالك بلا شركة (افتراض الأداة) ──
update public.profiles set company_id = null
where id = '00000000-2000-4000-8000-000000000001';

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-2000-4000-8000-000000000001', true);

insert into public.test_results (category, name, passed, detail)
select 'عزل المالك', 'المالك بلا شركة لا يرى أي مستند',
       count(*) = 0, 'رأى=' || count(*)
from public.documents;

insert into public.test_results (category, name, passed, detail)
select 'عزل المالك', 'المالك بلا شركة لا يرى أي مقطع',
       count(*) = 0, 'رأى=' || count(*)
from public.document_chunks;

commit;
