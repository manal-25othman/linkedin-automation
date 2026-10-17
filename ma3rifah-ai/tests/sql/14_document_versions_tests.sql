-- =====================================================================
-- المجموعة ١٥ — هوية الوثيقة وإصداراتها (0041)
-- =====================================================================
-- الادّعاء الذي تُثبته هذه المجموعة أربعة أشقاق، وكلها قابلة للانكسار
-- صامتةً لأن أثرها يظهر في **نصّ إجابة** لا في رسالة خطأ:
--
-- ١) **حداثة الرفع لا تعني المرجعية.** إصدار جديد مفهرس وغير معتمد
--    لا يدخل الإجابات الاعتيادية. ولو دخل، لأجابت المنصّة من مسوّدة
--    ولم يعلم أحد — وهذا أسوأ عطل ممكن في منتج معرفة.
-- ٢) **لا اعتماد قبل الفهرسة.** الاعتماد المبكّر يُنتج مرجعًا لا مقاطع
--    له، أي سياسةً «معتمدة» لا يجدها السؤال.
-- ٣) **لا فترة خليط.** تبديل الإصدار الفعّال معاملةٌ واحدة: لا لحظةَ
--    تُجيب فيها المنصّة من النسختين معًا.
-- ٤) **العزل باقٍ.** العائلة والسجلّ والدوالّ كلها داخل حدّ الشركة.

\set company_a      '''aaaaaaaa-0000-4000-8000-000000000001'''
\set company_b      '''bbbbbbbb-0000-4000-8000-000000000001'''
\set user_a_admin   '''aaaaaaaa-2000-4000-8000-000000000001'''
\set user_a_hr_emp  '''aaaaaaaa-2000-4000-8000-000000000003'''
\set user_b_admin   '''bbbbbbbb-2000-4000-8000-000000000001'''
\set doc_a1         '''aaaaaaaa-3000-4000-8000-000000000001'''

-- ══════════════════ الترحيل أنتج عائلةً لكل وثيقة قائمة ══════════════════

insert into public.test_results (category, name, passed, detail)
select 'إصدارات الوثائق', 'كل وثيقة قائمة لها عائلة بعد الترحيل',
       count(*) = 0, 'بلا عائلة=' || count(*)
from public.documents where family_id is null;

insert into public.test_results (category, name, passed, detail)
select 'إصدارات الوثائق',
       'الوثائق المرحَّلة لم تُدَّع معتمدة (MIGRATED_UNREVIEWED لا APPROVED)',
       count(*) = 0, 'ادُّعي اعتمادها=' || count(*)
from public.documents d
join public.document_version_events e
  on e.document_id = d.id and e.event = 'MIGRATED'
where d.approval_status = 'APPROVED';

insert into public.test_results (category, name, passed, detail)
select 'إصدارات الوثائق', 'الوثيقة المفهرسة المرحَّلة صارت الإصدار الفعّال',
       count(*) > 0, 'فعّالة=' || count(*)
from public.document_families f
join public.documents d on d.id = f.effective_document_id
where f.company_id = :company_a::uuid and d.status = 'READY';

-- ══════════════════ إصدار جديد غير معتمد لا يُجيب ══════════════════
-- إصدار ثانٍ في عائلة الوثيقة أ: مفهرس (READY) ومقاطعه مضمَّنة،
-- وغير معتمد. فيجب أن يبقى خارج الاسترجاع تمامًا.

insert into public.documents
  (id, company_id, family_id, name, file_type, file_size_bytes, status,
   visibility, uploaded_by, approval_status, version_label)
select 'aaaaaaaa-3000-4000-8000-0000000000f1', :company_a::uuid, d.family_id,
       'دليل الموظف — الشركة أ (إصدار ٢)', 'text/plain', 120, 'READY',
       'COMPANY', :user_a_admin::uuid, 'DRAFT', '2'
from public.documents d where d.id = :doc_a1::uuid
on conflict (id) do nothing;

insert into public.document_chunks
  (id, company_id, document_id, chunk_index, content, embedding)
values ('aaaaaaaa-4000-4000-8000-0000000000f1', :company_a::uuid,
        'aaaaaaaa-3000-4000-8000-0000000000f1', 0,
        'بدل السكن في الإصدار الثاني ثلاثة آلاف ريال شهريًا لكل موظف.',
        array_fill(0.05::real, array[1024])::vector)
on conflict (id) do nothing;

insert into public.test_results (category, name, passed, detail)
select 'إصدارات الوثائق',
       'الإصدار الثاني لم يصر فعّالًا بمجرد فهرسته (العائلة لها فعّال سابق)',
       coalesce(f.effective_document_id = :doc_a1::uuid, false),
       'الفعّال=' || coalesce(f.effective_document_id::text, 'لا شيء')
from public.document_families f
join public.documents d on d.family_id = f.id
where d.id = 'aaaaaaaa-3000-4000-8000-0000000000f1';

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_a_hr_emp, true);

-- الاسترجاع يجب أن يتجاهل مقطع الإصدار غير المعتمد تمامًا
insert into public.test_results (category, name, passed, detail)
select 'إصدارات الوثائق',
       'الاسترجاع لا يُرجع مقطعًا من إصدار غير فعّال (ضابط سالب)',
       count(*) = 0, 'رجع=' || count(*)
from public.match_document_chunks_hybrid(
       array_fill(0.05::real, array[1024])::vector,
       'بدل السكن', 20, 0.0, null) m
where m.document_id = 'aaaaaaaa-3000-4000-8000-0000000000f1';

-- وضابط موجب يمنع أن يمرّ الاختبار أعلاه بسبب استرجاعٍ خاوٍ أصلًا
insert into public.test_results (category, name, passed, detail)
select 'إصدارات الوثائق',
       'والاسترجاع يُرجع الإصدار الفعّال (ضابط موجب)',
       count(*) > 0, 'رجع=' || count(*)
from public.match_document_chunks_hybrid(
       array_fill(0.05::real, array[1024])::vector,
       'بدل السكن', 20, 0.0, null) m
where m.document_id = :doc_a1::uuid;
commit;


-- ══════════════════ لا اعتماد قبل الفهرسة ══════════════════
-- إصدار ثالث قيد المعالجة. الاعتماد قبل الفهرسة يُنتج مرجعًا لا مقاطع
-- له، أي سياسةً «معتمدة» لا يجدها السؤال — ولذلك حاجزان: شرطٌ في
-- الدالّة، وقيدٌ على الجدول يمنع الالتفاف عليها.

insert into public.documents
  (id, company_id, family_id, name, file_type, file_size_bytes, status,
   visibility, uploaded_by, approval_status, version_label)
select 'aaaaaaaa-3000-4000-8000-0000000000f2', :company_a::uuid, d.family_id,
       'دليل الموظف — الشركة أ (إصدار ٣ قيد المعالجة)', 'text/plain', 120,
       'PROCESSING', 'COMPANY', :user_a_admin::uuid, 'DRAFT', '3'
from public.documents d where d.id = :doc_a1::uuid
on conflict (id) do nothing;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_a_admin, true);

do $$
declare v_blocked boolean := false;
begin
  begin
    perform public.approve_document_version('aaaaaaaa-3000-4000-8000-0000000000f2');
  exception when others then v_blocked := true;
  end;
  insert into public.test_results (category, name, passed, detail)
  values ('إصدارات الوثائق', 'الدالّة ترفض اعتماد إصدار لم تكتمل فهرسته',
          v_blocked, case when v_blocked then 'مُنع' else 'نفذ!' end);
end $$;

do $$
declare v_blocked boolean := false; v_family uuid;
begin
  select family_id into v_family from public.documents
   where id = 'aaaaaaaa-3000-4000-8000-0000000000f2';
  begin
    update public.document_families
       set effective_document_id = 'aaaaaaaa-3000-4000-8000-0000000000f2'
     where id = v_family;
  exception when others then v_blocked := true;
  end;
  insert into public.test_results (category, name, passed, detail)
  values ('إصدارات الوثائق',
          'قيد القاعدة يمنع تعيين إصدار غير مفهرس مرجعًا (حاجز بنيوي)',
          v_blocked, case when v_blocked then 'مُنع' else 'نفذ!' end);
end $$;
commit;

-- ══════════════════ الصلاحية: الموظف لا يعتمد ولا يحرّر ══════════════════
-- يُقدَّم على الاعتماد الناجح عن قصد: الإصدار الثاني لم يُعتمد بعد، فلو
-- نفذت محاولة الموظف لظهر أثرها في اختبار «لا فترة خليط» بعدها.

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_a_hr_emp, true);

do $$
declare v_blocked boolean := false;
begin
  begin
    perform public.approve_document_version('aaaaaaaa-3000-4000-8000-0000000000f1');
  exception when others then v_blocked := true;
  end;
  insert into public.test_results (category, name, passed, detail)
  values ('إصدارات الوثائق', 'الموظف لا يعتمد إصدارًا (ضابط سالب)',
          v_blocked, case when v_blocked then 'مُنع' else 'نفذ!' end);
end $$;

-- RLS تمنع الكتابة، فالتحديث يُصيب صفرًا من الصفوف لا أن يُخطئ
do $$
declare v_rows int;
begin
  update public.document_families set title = 'محاولة موظف'
   where company_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  get diagnostics v_rows = row_count;
  insert into public.test_results (category, name, passed, detail)
  values ('إصدارات الوثائق', 'الموظف لا يحرّر عائلات وثائق شركته (ضابط سالب)',
          v_rows = 0, 'عدّل=' || v_rows);
end $$;
commit;

-- ══════════════════ العزل بين الشركات ══════════════════

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_b_admin, true);

insert into public.test_results (category, name, passed, detail)
select 'إصدارات الوثائق', 'مدير الشركة ب لا يرى عائلات الشركة أ',
       count(*) = 0, 'رأى=' || count(*)
from public.document_families where company_id = :company_a::uuid;

insert into public.test_results (category, name, passed, detail)
select 'إصدارات الوثائق', 'مدير الشركة ب لا يرى سجلّ إصدارات الشركة أ',
       count(*) = 0, 'رأى=' || count(*)
from public.document_version_events where company_id = :company_a::uuid;

do $$
declare v_blocked boolean := false;
begin
  begin
    perform public.approve_document_version('aaaaaaaa-3000-4000-8000-0000000000f1');
  exception when others then v_blocked := true;
  end;
  insert into public.test_results (category, name, passed, detail)
  values ('إصدارات الوثائق',
          'مدير الشركة ب لا يعتمد إصدارًا للشركة أ (ضابط سالب)',
          v_blocked, case when v_blocked then 'مُنع' else 'نفذ!' end);
end $$;

insert into public.test_results (category, name, passed, detail)
select 'إصدارات الوثائق',
       'دالّة مقاطع الإصدار لا تعبر حدّ الشركة (ضابط سالب)',
       count(*) = 0, 'رجع=' || count(*)
from public.chunks_of_document_version(:doc_a1::uuid);
commit;

-- ══════════════════ الاعتماد: ضابط موجب + لا فترة خليط ══════════════════

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_a_admin, true);

-- يُلفّ بكتلة تمسك الاستثناء: تحت الطفرات تتغيّر الحرّاس، ونداءٌ
-- مجرَّد يرمي استثناءً يُسقط المجموعة كلها فلا تُعدّ الإخفاقات.
do $$
begin
  perform public.approve_document_version(
    'aaaaaaaa-3000-4000-8000-0000000000f1', current_date, 'اختبار اعتماد');
exception when others then
  insert into public.test_results (category, name, passed, detail)
  values ('إصدارات الوثائق', 'الاعتماد نفذ بوصفه ضابطًا موجبًا', false, sqlerrm);
end $$;

insert into public.test_results (category, name, passed, detail)
select 'إصدارات الوثائق', 'الاعتماد حوّل مؤشّر العائلة إلى الإصدار الجديد',
       coalesce(f.effective_document_id = 'aaaaaaaa-3000-4000-8000-0000000000f1', false),
       'الفعّال=' || coalesce(f.effective_document_id::text, 'لا شيء')
from public.document_families f
where f.id = (select family_id from public.documents
               where id = 'aaaaaaaa-3000-4000-8000-0000000000f1');

insert into public.test_results (category, name, passed, detail)
select 'إصدارات الوثائق', 'الإصدار السابق صار SUPERSEDED لا محذوفًا',
       approval_status = 'SUPERSEDED', 'الحالة=' || approval_status::text
from public.documents where id = :doc_a1::uuid;

insert into public.test_results (category, name, passed, detail)
select 'إصدارات الوثائق', 'الاعتماد سجّل صاحبه وتاريخه',
       approved_by is not null and approved_at is not null,
       'معتمِد=' || coalesce(approved_by::text, 'لا شيء')
from public.documents where id = 'aaaaaaaa-3000-4000-8000-0000000000f1';

insert into public.test_results (category, name, passed, detail)
select 'إصدارات الوثائق', 'علاقة الاستبدال مسجَّلة على الإصدار الجديد',
       coalesce(supersedes_document_id = :doc_a1::uuid, false),
       'يستبدل=' || coalesce(supersedes_document_id::text, 'لا شيء')
from public.documents where id = 'aaaaaaaa-3000-4000-8000-0000000000f1';

-- لا فترة خليط: إصدار فعّال واحد في العائلة في أي لحظة
insert into public.test_results (category, name, passed, detail)
select 'إصدارات الوثائق', 'إصدار فعّال واحد لكل عائلة — لا خليط',
       count(*) = 1, 'فعّالة في العائلة=' || count(*)
from public.documents d
join public.document_families f on f.id = d.family_id
where f.id = (select family_id from public.documents
               where id = 'aaaaaaaa-3000-4000-8000-0000000000f1')
  and f.effective_document_id = d.id;

insert into public.test_results (category, name, passed, detail)
select 'إصدارات الوثائق', 'حدث الاعتماد مسجَّل في سجلّ الإصدارات',
       count(*) = 1, 'أحداث اعتماد=' || count(*)
from public.document_version_events
where document_id = 'aaaaaaaa-3000-4000-8000-0000000000f1' and event = 'APPROVED';
commit;

-- ══════════════════ والمستبدَل يخرج من الإجابات فورًا ══════════════════

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_a_hr_emp, true);

insert into public.test_results (category, name, passed, detail)
select 'إصدارات الوثائق',
       'الإصدار المستبدَل خرج من الاسترجاع بعد الاعتماد (ضابط سالب)',
       count(*) = 0, 'رجع=' || count(*)
from public.match_document_chunks_hybrid(
       array_fill(0.05::real, array[1024])::vector,
       'بدل السكن', 20, 0.0, null) m
where m.document_id = :doc_a1::uuid;

insert into public.test_results (category, name, passed, detail)
select 'إصدارات الوثائق',
       'والإصدار المعتمَد الجديد صار هو من يُجيب (ضابط موجب)',
       count(*) > 0, 'رجع=' || count(*)
from public.match_document_chunks_hybrid(
       array_fill(0.05::real, array[1024])::vector,
       'بدل السكن', 20, 0.0, null) m
where m.document_id = 'aaaaaaaa-3000-4000-8000-0000000000f1';
commit;

-- ══════════════════ الأرشفة تُفرّغ المؤشّر صراحةً ══════════════════
-- تُؤرشف **الإصدار الفعّال الحالي** (f1 بعد اعتماده). وشركةٌ بلا مرجع
-- أوضح من شركةٍ مرجعُها مؤرشف.

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_a_admin, true);

do $$
begin
  perform public.archive_document_version(
    'aaaaaaaa-3000-4000-8000-0000000000f1', 'اختبار أرشفة');
exception when others then
  insert into public.test_results (category, name, passed, detail)
  values ('إصدارات الوثائق', 'الأرشفة نفذت بوصفها ضابطًا موجبًا', false, sqlerrm);
end $$;

insert into public.test_results (category, name, passed, detail)
select 'إصدارات الوثائق', 'أرشفة الإصدار الفعّال تُفرّغ مؤشّر العائلة',
       effective_document_id is null,
       'الفعّال=' || coalesce(effective_document_id::text, 'لا شيء')
from public.document_families
where id = (select family_id from public.documents
             where id = 'aaaaaaaa-3000-4000-8000-0000000000f1');

insert into public.test_results (category, name, passed, detail)
select 'إصدارات الوثائق', 'والمؤرشف لا يُجيب بعد ذلك (ضابط سالب)',
       count(*) = 0, 'رجع=' || count(*)
from public.match_document_chunks_hybrid(
       array_fill(0.05::real, array[1024])::vector,
       'بدل السكن', 20, 0.0, null) m
where m.document_id = 'aaaaaaaa-3000-4000-8000-0000000000f1';
commit;
