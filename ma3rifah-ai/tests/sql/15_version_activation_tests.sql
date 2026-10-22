-- =====================================================================
-- المجموعة ١٦ — تفعيل الإصدارات وظهور العائلة (0042)
-- =====================================================================
-- أربعة ادّعاءات، وكلها تصحيحٌ لسلوكٍ كان في `0041`:
--
-- ١) **لا تفعيل تلقائي.** الفهرسة تُنتج وثيقة *جاهزة للاعتماد* لا
--    مرجعًا. وكان أول إصدار يُفعَّل تلقائيًا، فتُجيب المنصّة من ملفٍ
--    لم يقرأه أحد.
-- ٢) **حالة الترحيل محجوزة.** لا تُسنَد إلى صفٍّ جديد، فلا يُشترى
--    التفعيل الاستثنائي برفعٍ جديد.
-- ٣) **تاريخ السريان المستقبلي لا يبدّل المرجع.** والاتجاه الآمن
--    مقصود: لو تأخّر التفعيل بقي القديم يُجيب.
-- ٤) **ظهور العائلة يتبع صلاحيات إصداراتها.** والعنوان وحده معلومة:
--    «ملف رواتب الموارد البشرية» يكشف لموظف المالية ما لا يحقّ له.

\set company_a      '''aaaaaaaa-0000-4000-8000-000000000001'''
\set company_b      '''bbbbbbbb-0000-4000-8000-000000000001'''
\set user_a_admin   '''aaaaaaaa-2000-4000-8000-000000000001'''
\set user_a_hr_mgr  '''aaaaaaaa-2000-4000-8000-000000000002'''
\set user_a_hr_emp  '''aaaaaaaa-2000-4000-8000-000000000003'''
\set user_a_fin_emp '''aaaaaaaa-2000-4000-8000-000000000004'''
\set dept_a_hr      '''aaaaaaaa-1000-4000-8000-000000000001'''
\set doc_a_hr       '''aaaaaaaa-3000-4000-8000-000000000002'''

-- ══════════════════ (١) لا تفعيل تلقائي لأول إصدار ══════════════════
-- عائلة جديدة تمامًا، وإصدار أول مفهرس ومقاطعه مضمَّنة. ويجب أن يبقى
-- خارج الإجابات حتى يعتمده مخوَّل.

insert into public.document_families (id, company_id, title, created_by)
values ('aaaaaaaa-6000-4000-8000-000000000001', :company_a::uuid,
        'لائحة جديدة — لم تُعتمد', :user_a_admin::uuid)
on conflict (id) do nothing;

insert into public.documents
  (id, company_id, family_id, name, file_type, file_size_bytes, status,
   visibility, uploaded_by, version_label)
values ('aaaaaaaa-3000-4000-8000-0000000000a1', :company_a::uuid,
        'aaaaaaaa-6000-4000-8000-000000000001',
        'لائحة جديدة — لم تُعتمد', 'text/plain', 100, 'READY',
        'COMPANY', :user_a_admin::uuid, '1')
on conflict (id) do nothing;

insert into public.document_chunks
  (id, company_id, document_id, chunk_index, content, embedding)
values ('aaaaaaaa-4000-4000-8000-0000000000a1', :company_a::uuid,
        'aaaaaaaa-3000-4000-8000-0000000000a1', 0,
        'اللائحة الجديدة تمنح بدل انتقال قدره ثمانمئة ريال شهريًا.',
        ('[1' || repeat(',0', 1023) || ']')::vector(1024))
on conflict (id) do nothing;

insert into public.test_results (category, name, passed, detail)
select 'تفعيل الإصدارات',
       'أول إصدار مفهرس لا يُفعَّل تلقائيًا (التصحيح الأول)',
       effective_document_id is null,
       'الفعّال=' || coalesce(effective_document_id::text, 'لا شيء')
from public.document_families
where id = 'aaaaaaaa-6000-4000-8000-000000000001';

insert into public.test_results (category, name, passed, detail)
select 'تفعيل الإصدارات',
       'وحالته DRAFT لا MIGRATED_UNREVIEWED ولا APPROVED',
       approval_status = 'DRAFT', 'الحالة=' || approval_status::text
from public.documents where id = 'aaaaaaaa-3000-4000-8000-0000000000a1';

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_a_hr_emp, true);

insert into public.test_results (category, name, passed, detail)
select 'تفعيل الإصدارات',
       'الوثيقة غير المعتمدة لا تدخل إجابات الموظفين (ضابط سالب)',
       count(*) = 0, 'رجع=' || count(*)
from public.match_document_chunks_hybrid(
       ('[1' || repeat(',0', 1023) || ']')::vector(1024),
       'بدل الانتقال', 20, 0.0, null) m
where m.document_id = 'aaaaaaaa-3000-4000-8000-0000000000a1';
commit;

-- ومعاينة المسؤول هي البديل: يجرّب المحتوى بلا أن يصل الموظفين
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_a_admin, true);

insert into public.test_results (category, name, passed, detail)
select 'تفعيل الإصدارات',
       'مدير الشركة يعاين الإصدار قبل اعتماده (ضابط موجب)',
       count(*) > 0, 'رجع=' || count(*)
from public.preview_document_version_chunks(
       'aaaaaaaa-3000-4000-8000-0000000000a1',
       ('[1' || repeat(',0', 1023) || ']')::vector(1024), 6);

insert into public.test_results (category, name, passed, detail)
select 'تفعيل الإصدارات',
       'وتظهر في قائمة المنتظرة مراجعة',
       count(*) > 0, 'رجع=' || count(*)
from public.families_awaiting_review()
where family_id = 'aaaaaaaa-6000-4000-8000-000000000001';
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_a_hr_emp, true);

insert into public.test_results (category, name, passed, detail)
select 'تفعيل الإصدارات',
       'والموظف لا يعاين إصدارًا غير معتمد (ضابط سالب)',
       count(*) = 0, 'رجع=' || count(*)
from public.preview_document_version_chunks(
       'aaaaaaaa-3000-4000-8000-0000000000a1',
       ('[1' || repeat(',0', 1023) || ']')::vector(1024), 6);

insert into public.test_results (category, name, passed, detail)
select 'تفعيل الإصدارات',
       'والموظف لا يرى قائمة المنتظرة مراجعة (ضابط سالب)',
       count(*) = 0, 'رجع=' || count(*)
from public.families_awaiting_review();
commit;

-- ثم الاعتماد الصريح يُدخلها الإجابات
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_a_admin, true);

do $$
begin
  perform public.approve_document_version(
    'aaaaaaaa-3000-4000-8000-0000000000a1', current_date, 'اعتماد صريح');
exception when others then
  insert into public.test_results (category, name, passed, detail)
  values ('تفعيل الإصدارات', 'الاعتماد الصريح نفذ', false, sqlerrm);
end $$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_a_hr_emp, true);

insert into public.test_results (category, name, passed, detail)
select 'تفعيل الإصدارات',
       'وبعد الاعتماد الصريح تُجيب (ضابط موجب)',
       count(*) > 0, 'رجع=' || count(*)
from public.match_document_chunks_hybrid(
       ('[1' || repeat(',0', 1023) || ']')::vector(1024),
       'بدل الانتقال', 20, 0.0, null) m
where m.document_id = 'aaaaaaaa-3000-4000-8000-0000000000a1';
commit;

-- ══════════════════ (٢) حالة الترحيل محجوزة ══════════════════

do $$
declare v_blocked boolean := false;
begin
  begin
    update public.documents
       set approval_status = 'MIGRATED_UNREVIEWED'
     where id = 'aaaaaaaa-3000-4000-8000-0000000000a1';
  exception when others then v_blocked := true;
  end;
  insert into public.test_results (category, name, passed, detail)
  values ('تفعيل الإصدارات',
          'حالة الترحيل لا تُسنَد إلى رفع جديد (التصحيح الثاني)',
          v_blocked, case when v_blocked then 'مُنع' else 'نفذ!' end);
end $$;

/*
 * ضابط موجب للقيد نفسه: القيد يسمح للمُرحَّل فعلًا.
 *
 * ولا يُفحَص بعدّ الصفوف المرحَّلة في قاعدة الاختبار: الترحيل في `0041`
 * يجري **قبل** مثبّتات البيانات، فالجدول خاوٍ لحظتَه ولا صفّ مرحَّل
 * أبدًا هنا. فيُحاكى الشرط: حدثُ ترحيل على صفّ، ثم تُسنَد له الحالة.
 */
do $$
declare v_ok boolean := false; v_family uuid;
begin
  select family_id into v_family from public.documents
   where id = 'aaaaaaaa-3000-4000-8000-0000000000a1';

  insert into public.document_version_events
    (company_id, family_id, document_id, event, note)
  values ('aaaaaaaa-0000-4000-8000-000000000001', v_family,
          'aaaaaaaa-3000-4000-8000-0000000000a1', 'MIGRATED',
          'محاكاة ترحيل لفحص الضابط الموجب');

  begin
    update public.documents
       set approval_status = 'MIGRATED_UNREVIEWED'
     where id = 'aaaaaaaa-3000-4000-8000-0000000000a1';
    v_ok := true;
  exception when others then v_ok := false;
  end;

  insert into public.test_results (category, name, passed, detail)
  values ('تفعيل الإصدارات',
          'والقيد يسمح بها لمن له حدث ترحيل فعلي (ضابط موجب)',
          v_ok, case when v_ok then 'سُمح' else 'مُنع!' end);

  -- تُعاد الحالة كي لا تتأثر الاختبارات التالية
  update public.documents set approval_status = 'APPROVED'
   where id = 'aaaaaaaa-3000-4000-8000-0000000000a1';
  delete from public.document_version_events
   where document_id = 'aaaaaaaa-3000-4000-8000-0000000000a1'
     and event = 'MIGRATED';
end $$;

-- ══════════════════ (٣) تاريخ السريان المستقبلي ══════════════════
-- إصدار ثانٍ في العائلة نفسها، يُعتمد بتاريخ الغد.

insert into public.documents
  (id, company_id, family_id, name, file_type, file_size_bytes, status,
   visibility, uploaded_by, version_label)
values ('aaaaaaaa-3000-4000-8000-0000000000a2', :company_a::uuid,
        'aaaaaaaa-6000-4000-8000-000000000001',
        'لائحة جديدة — إصدار ٢ يسري غدًا', 'text/plain', 100, 'READY',
        'COMPANY', :user_a_admin::uuid, '2')
on conflict (id) do nothing;

insert into public.document_chunks
  (id, company_id, document_id, chunk_index, content, embedding)
values ('aaaaaaaa-4000-4000-8000-0000000000a2', :company_a::uuid,
        'aaaaaaaa-3000-4000-8000-0000000000a2', 0,
        'اللائحة المعدّلة ترفع بدل الانتقال إلى ألف ومئتي ريال شهريًا.',
        ('[1' || repeat(',0', 1023) || ']')::vector(1024))
on conflict (id) do nothing;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_a_admin, true);

do $$
begin
  perform public.approve_document_version(
    'aaaaaaaa-3000-4000-8000-0000000000a2',
    (current_date + 1)::date, 'يسري غدًا');
exception when others then
  insert into public.test_results (category, name, passed, detail)
  values ('تفعيل الإصدارات', 'اعتماد مؤجَّل نفذ', false, sqlerrm);
end $$;
commit;

insert into public.test_results (category, name, passed, detail)
select 'تفعيل الإصدارات',
       'الاعتماد المؤجَّل ثبّت القرار (APPROVED بتاريخ الغد)',
       approval_status = 'APPROVED' and effective_from = (current_date + 1)::date,
       'الحالة=' || approval_status::text || ' من ' || coalesce(effective_from::text,'—')
from public.documents where id = 'aaaaaaaa-3000-4000-8000-0000000000a2';

insert into public.test_results (category, name, passed, detail)
select 'تفعيل الإصدارات',
       'ولم يبدّل المرجع الحالي (التصحيح الثالث)',
       coalesce(effective_document_id = 'aaaaaaaa-3000-4000-8000-0000000000a1', false),
       'الفعّال=' || coalesce(effective_document_id::text, 'لا شيء')
from public.document_families
where id = 'aaaaaaaa-6000-4000-8000-000000000001';

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_a_hr_emp, true);

insert into public.test_results (category, name, passed, detail)
select 'تفعيل الإصدارات',
       'الإصدار المستقبلي لا يدخل الإجابات قبل موعده (ضابط سالب)',
       count(*) = 0, 'رجع=' || count(*)
from public.match_document_chunks_hybrid(
       ('[1' || repeat(',0', 1023) || ']')::vector(1024),
       'بدل الانتقال', 20, 0.0, null) m
where m.document_id = 'aaaaaaaa-3000-4000-8000-0000000000a2';

insert into public.test_results (category, name, passed, detail)
select 'تفعيل الإصدارات',
       'والقديم ما زال هو من يُجيب (ضابط موجب)',
       count(*) > 0, 'رجع=' || count(*)
from public.match_document_chunks_hybrid(
       ('[1' || repeat(',0', 1023) || ']')::vector(1024),
       'بدل الانتقال', 20, 0.0, null) m
where m.document_id = 'aaaaaaaa-3000-4000-8000-0000000000a1';
commit;

-- بلوغ الموعد: يُقدَّم التاريخ يومًا فتصير مستحقّة، ثم تُشغَّل المهمة
update public.documents
   set effective_from = current_date
 where id = 'aaaaaaaa-3000-4000-8000-0000000000a2';

do $$ begin perform public.activate_due_document_versions(); end $$;

insert into public.test_results (category, name, passed, detail)
select 'تفعيل الإصدارات',
       'المهمة الدورية فعّلت الإصدار عند بلوغ موعده',
       coalesce(effective_document_id = 'aaaaaaaa-3000-4000-8000-0000000000a2', false),
       'الفعّال=' || coalesce(effective_document_id::text, 'لا شيء')
from public.document_families
where id = 'aaaaaaaa-6000-4000-8000-000000000001';

insert into public.test_results (category, name, passed, detail)
select 'تفعيل الإصدارات',
       'والتفعيل المجدول مسجَّل حدثًا',
       count(*) = 1, 'أحداث=' || count(*)
from public.document_version_events
where document_id = 'aaaaaaaa-3000-4000-8000-0000000000a2'
  and event = 'ACTIVATED_ON_SCHEDULE';

-- ══════════════════ (٣ب) إصدار مستحقّ لم تكتمل فهرسته ══════════════════
-- يجب أن يُتخطّى، ويبقى السابق مرجعًا — والاتجاه الآمن مقصود.

insert into public.documents
  (id, company_id, family_id, name, file_type, file_size_bytes, status,
   visibility, uploaded_by, version_label, approval_status, effective_from,
   approved_by, approved_at)
values ('aaaaaaaa-3000-4000-8000-0000000000a3', :company_a::uuid,
        'aaaaaaaa-6000-4000-8000-000000000001',
        'لائحة جديدة — إصدار ٣ فشلت فهرسته', 'text/plain', 100, 'FAILED',
        'COMPANY', :user_a_admin::uuid, '3', 'APPROVED', current_date,
        :user_a_admin::uuid, now())
on conflict (id) do nothing;

do $$ begin perform public.activate_due_document_versions(); end $$;

insert into public.test_results (category, name, passed, detail)
select 'تفعيل الإصدارات',
       'الإصدار المستحقّ غير المفهرس لا يُفعَّل — والسابق يبقى مرجعًا',
       coalesce(effective_document_id = 'aaaaaaaa-3000-4000-8000-0000000000a2', false),
       'الفعّال=' || coalesce(effective_document_id::text, 'لا شيء')
from public.document_families
where id = 'aaaaaaaa-6000-4000-8000-000000000001';

insert into public.test_results (category, name, passed, detail)
select 'تفعيل الإصدارات',
       'وتخطّيه مسجَّل حدثًا لا يمرّ صامتًا',
       count(*) > 0, 'أحداث=' || count(*)
from public.document_version_events
where document_id = 'aaaaaaaa-3000-4000-8000-0000000000a3'
  and event = 'SCHEDULED';

-- ══════════════════ (٤) ظهور العائلة يتبع الصلاحيات ══════════════════
-- نفس الشركة، صلاحيات مختلفة: موظف المالية مقابل وثيقة مقصورة على
-- الموارد البشرية. والعنوان وحده معلومة.

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_a_fin_emp, true);

insert into public.test_results (category, name, passed, detail)
select 'تفعيل الإصدارات',
       'موظف المالية لا يرى عائلة وثيقة الموارد البشرية (التصحيح الرابع)',
       count(*) = 0, 'رأى=' || count(*)
from public.document_families f
join public.documents d on d.family_id = f.id
where d.id = :doc_a_hr::uuid;

insert into public.test_results (category, name, passed, detail)
select 'تفعيل الإصدارات',
       'ولا يرى إصدارها',
       count(*) = 0, 'رأى=' || count(*)
from public.documents where id = :doc_a_hr::uuid;

insert into public.test_results (category, name, passed, detail)
select 'تفعيل الإصدارات',
       'ولا أحداث سجلّها',
       count(*) = 0, 'رأى=' || count(*)
from public.document_version_events e
join public.documents d on d.family_id = e.family_id
where d.id = :doc_a_hr::uuid;

-- ضابط موجب: يرى عائلة الوثيقة العامة — فالحجب ليس حجبًا شاملًا
insert into public.test_results (category, name, passed, detail)
select 'تفعيل الإصدارات',
       'ويرى عائلة الوثيقة العامة (ضابط موجب)',
       count(*) > 0, 'رأى=' || count(*)
from public.document_families f
join public.documents d on d.family_id = f.id
where d.id = 'aaaaaaaa-3000-4000-8000-000000000001';
commit;

-- وموظف الموارد البشرية يرى عائلة وثيقة قسمه (ضابط موجب)
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_a_hr_emp, true);

insert into public.test_results (category, name, passed, detail)
select 'تفعيل الإصدارات',
       'موظف الموارد البشرية يرى عائلة وثيقة قسمه (ضابط موجب)',
       count(*) > 0, 'رأى=' || count(*)
from public.document_families f
join public.documents d on d.family_id = f.id
where d.id = :doc_a_hr::uuid;
commit;

-- ومدير القسم لا يرى سجلّ وثيقةٍ مقصورة على دور مدير الشركة
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_a_hr_mgr, true);

insert into public.test_results (category, name, passed, detail)
select 'تفعيل الإصدارات',
       'مدير القسم لا يرى عائلة الوثيقة المقصورة على مدير الشركة',
       count(*) = 0, 'رأى=' || count(*)
from public.document_families f
join public.documents d on d.family_id = f.id
where d.id = 'aaaaaaaa-3000-4000-8000-000000000003';
commit;

-- تنظيف
delete from public.document_chunks
 where id in ('aaaaaaaa-4000-4000-8000-0000000000a1',
              'aaaaaaaa-4000-4000-8000-0000000000a2');
delete from public.documents
 where id in ('aaaaaaaa-3000-4000-8000-0000000000a1',
              'aaaaaaaa-3000-4000-8000-0000000000a2',
              'aaaaaaaa-3000-4000-8000-0000000000a3');
delete from public.document_families
 where id = 'aaaaaaaa-6000-4000-8000-000000000001';
