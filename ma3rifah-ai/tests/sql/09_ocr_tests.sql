-- =====================================================================
-- المجموعة ١٠ — القراءة الضوئية (0036)
-- =====================================================================
-- الحصة الشهرية تُحاسِب وتمنع، وتتبع الخطة ثم التجاوز الفردي، ولا تخلط
-- شركة بشركة. ونصوص الصفحات المقروءة لا يصل إليها مستخدم مباشرة.

-- خطة الاختبار: خمس صفحات شهريًا
update public.plans set max_ocr_pages_monthly = 5
where id = 'cccccccc-5000-4000-8000-000000000001';

-- تسجيل ثلاث صفحات للشركة أ
select public.record_usage(
  'aaaaaaaa-0000-4000-8000-000000000001'::uuid, 0, 1000, 500, 0.01, 3);

insert into public.test_results (category, name, passed, detail)
select 'القراءة الضوئية', 'record_usage يجمع صفحات القراءة في عدّاد الشهر',
       coalesce(ocr_pages, 0) = 3, 'ocr_pages=' || coalesce(ocr_pages, 0)
from public.usage_records
where company_id = 'aaaaaaaa-0000-4000-8000-000000000001'
  and period_month = date_trunc('month', now())::date;

insert into public.test_results (category, name, passed, detail)
select 'القراءة الضوئية', 'ضمن الحصة: ٣ مستهلكة + ٢ ≤ ٥ يُسمح',
       allowed and used = 3 and quota = 5, 'allowed=' || allowed || ' used=' || used || ' quota=' || quota
from public.check_ocr_quota('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 2);

insert into public.test_results (category, name, passed, detail)
select 'القراءة الضوئية', 'فوق الحصة: ٣ مستهلكة + ٣ > ٥ يُمنع',
       not allowed and used = 3 and quota = 5, 'allowed=' || allowed
from public.check_ocr_quota('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 3);

-- الشركة ب لم تقرأ شيئًا — عدّادها لا يتأثر بالشركة أ
insert into public.test_results (category, name, passed, detail)
select 'القراءة الضوئية', 'عدّاد الشركة ب مستقل عن الشركة أ',
       allowed and used = 0, 'used=' || used
from public.check_ocr_quota('bbbbbbbb-0000-4000-8000-000000000001'::uuid, 5);

-- التجاوز الفردي في الاشتراك يعلو على حدّ الخطة
update public.subscriptions
   set limit_overrides = jsonb_build_object('max_ocr_pages_monthly', 10)
 where company_id = 'aaaaaaaa-0000-4000-8000-000000000001';

insert into public.test_results (category, name, passed, detail)
select 'القراءة الضوئية', 'تجاوز الاشتراك (١٠) يعلو على الخطة (٥)',
       allowed and quota = 10, 'allowed=' || allowed || ' quota=' || quota
from public.check_ocr_quota('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 3);

update public.subscriptions set limit_overrides = '{}'::jsonb
 where company_id = 'aaaaaaaa-0000-4000-8000-000000000001';

-- بلا حد في الخطة = مسموح دائمًا و quota = -1
update public.plans set max_ocr_pages_monthly = null
where id = 'cccccccc-5000-4000-8000-000000000001';

insert into public.test_results (category, name, passed, detail)
select 'القراءة الضوئية', 'خطة بلا حد: يُسمح والحصة -1',
       allowed and quota = -1, 'quota=' || quota
from public.check_ocr_quota('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 1000);

update public.plans set max_ocr_pages_monthly = 5
where id = 'cccccccc-5000-4000-8000-000000000001';

-- ── عزل نصوص الصفحات المقروءة ──
-- صفحة مقروءة لمستند الشركة أ العام، تُزرع بمفتاح الخدمة (superuser هنا)
insert into public.document_ocr_pages (document_id, company_id, page_number, text)
values ('aaaaaaaa-3000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 1,
        'نص صفحة مقروءة ضوئيًا — سرّي')
on conflict do nothing;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-2000-4000-8000-000000000001', true);

-- مدير الشركة أ نفسه لا يقرأ الجدول مباشرة: لا سياسة ولا امتياز
do $$
declare v_count int;
begin
  begin
    select count(*) into v_count from public.document_ocr_pages;
    insert into public.test_results (category, name, passed, detail)
    values ('القراءة الضوئية', 'مدير الشركة لا يقرأ جدول الصفحات المقروءة مباشرة',
            v_count = 0, 'رأى=' || v_count);
  exception when insufficient_privilege then
    insert into public.test_results (category, name, passed, detail)
    values ('القراءة الضوئية', 'مدير الشركة لا يقرأ جدول الصفحات المقروءة مباشرة', true, 'مرفوض');
  end;

  begin
    perform * from public.check_ocr_quota('bbbbbbbb-0000-4000-8000-000000000001'::uuid, 1);
    insert into public.test_results (category, name, passed, detail)
    values ('القراءة الضوئية', 'مستخدم مصادَق لا يفحص حصة شركة أخرى', false, 'نفّذها!');
  exception when insufficient_privilege then
    insert into public.test_results (category, name, passed, detail)
    values ('القراءة الضوئية', 'مستخدم مصادَق لا يفحص حصة شركة أخرى', true, null);
  end;

  begin
    perform public.record_usage('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 0, 0, 0, 0, 1);
    insert into public.test_results (category, name, passed, detail)
    values ('القراءة الضوئية', 'مستخدم مصادَق لا يسجّل استهلاكًا بنفسه', false, 'نفّذها!');
  exception when insufficient_privilege then
    insert into public.test_results (category, name, passed, detail)
    values ('القراءة الضوئية', 'مستخدم مصادَق لا يسجّل استهلاكًا بنفسه', true, null);
  end;
end $$;

commit;
