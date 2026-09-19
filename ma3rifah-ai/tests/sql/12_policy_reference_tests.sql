-- =====================================================================
-- المجموعة ١٣ — المكتبة المرجعية الرسمية (0039)
-- =====================================================================
-- الادّعاء الذي تُثبته هذه المجموعة شِقّان:
--
-- الأول أن المكتبة **مقروءة للجميع ومكتوبة للمالكة وحدها** — وهذا
-- استثناء مقصود عن قاعدة العزل، فيجب أن يُثبَت في الاتجاهين لا في
-- اتجاه واحد: أن الموظف يقرأ، وأنه **لا يكتب**.
--
-- والثاني — وهو الأهمّ — أن المكتبة **لا تتسرّب إلى استرجاع الشركات**.
-- لأن نظام العمل لو ظهر لموظف بوصفه لائحةَ شركته، صارت المنصّة تُفتي
-- باسم صاحب العمل. وهذا يُثبَت هنا بأن دالّة استرجاع الشركات لا تعرف
-- الجدول أصلًا، وأن جدول مقاطع الشركات لم يزدد صفًّا واحدًا.

\set user_a_admin   '''aaaaaaaa-2000-4000-8000-000000000001'''
\set user_a_hr_emp  '''aaaaaaaa-2000-4000-8000-000000000003'''
\set user_b_admin   '''bbbbbbbb-2000-4000-8000-000000000001'''

-- وثيقتان بمفتاح الخدمة: واحدة منشورة وأخرى ما زالت تُعالَج. والثانية
-- ليست زينة — المواصفة تشترط ألّا تُقرأ وثيقة قبل اكتمال فهرستها،
-- وإلا استشهدت المسوّدة بنصٍّ نصفِ مفهرس.
insert into public.platform_reference_documents
  (id, name, authority, reference_code, status)
values
  ('ffffffff-0000-4000-8000-000000000001',
   'نظام العمل — نصّ اختباري', 'وزارة الموارد البشرية', 'المادة ٧٤', 'READY'),
  ('ffffffff-0000-4000-8000-000000000002',
   'لائحة قيد المعالجة — نصّ اختباري', 'جهة اختبارية', null, 'PROCESSING')
on conflict (id) do nothing;

insert into public.platform_reference_chunks
  (document_id, chunk_index, content)
values
  ('ffffffff-0000-4000-8000-000000000001', 0, 'نصّ مرجعي منشور للاختبار.'),
  ('ffffffff-0000-4000-8000-000000000002', 0, 'نصّ مرجعي قيد المعالجة للاختبار.')
on conflict (document_id, chunk_index) do nothing;

-- ══════════════════ موظف عادي في الشركة أ ══════════════════
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_a_hr_emp, true);

insert into public.test_results (category, name, passed, detail)
select 'المكتبة المرجعية', 'الموظف يقرأ الوثيقة المنشورة (ضابط موجب)',
       count(*) = 1, 'قرأ=' || count(*)
from public.platform_reference_documents
where id = 'ffffffff-0000-4000-8000-000000000001';

insert into public.test_results (category, name, passed, detail)
select 'المكتبة المرجعية', 'الموظف لا يرى وثيقة قيد المعالجة',
       count(*) = 0, 'رأى=' || count(*)
from public.platform_reference_documents
where id = 'ffffffff-0000-4000-8000-000000000002';

insert into public.test_results (category, name, passed, detail)
select 'المكتبة المرجعية', 'الموظف يقرأ مقاطع الوثيقة المنشورة',
       count(*) = 1, 'قرأ=' || count(*)
from public.platform_reference_chunks
where document_id = 'ffffffff-0000-4000-8000-000000000001';

insert into public.test_results (category, name, passed, detail)
select 'المكتبة المرجعية', 'الموظف لا يقرأ مقاطع وثيقة قيد المعالجة',
       count(*) = 0, 'قرأ=' || count(*)
from public.platform_reference_chunks
where document_id = 'ffffffff-0000-4000-8000-000000000002';

-- الضابط السالب الذي يحمي المكتبة من التلوّث
do $$
declare v_blocked boolean := false;
begin
  begin
    insert into public.platform_reference_documents (name, authority)
    values ('محاولة موظف', 'جهة');
  exception when others then v_blocked := true;
  end;
  insert into public.test_results (category, name, passed, detail)
  values ('المكتبة المرجعية', 'الموظف لا يكتب في المكتبة (ضابط سالب)',
          v_blocked, case when v_blocked then 'مُنع' else 'كَتَب — خرق' end);
end $$;

do $$
declare v_updated int;
begin
  update public.platform_reference_documents
  set name = 'اسم مُغيَّر'
  where id = 'ffffffff-0000-4000-8000-000000000001';
  get diagnostics v_updated = row_count;
  insert into public.test_results (category, name, passed, detail)
  values ('المكتبة المرجعية', 'الموظف لا يعدّل وثيقة مرجعية',
          v_updated = 0, 'عدّل=' || v_updated);
end $$;

do $$
declare v_deleted int;
begin
  delete from public.platform_reference_chunks
  where document_id = 'ffffffff-0000-4000-8000-000000000001';
  get diagnostics v_deleted = row_count;
  insert into public.test_results (category, name, passed, detail)
  values ('المكتبة المرجعية', 'الموظف لا يحذف مقاطع مرجعية',
          v_deleted = 0, 'حذف=' || v_deleted);
end $$;

commit;

-- ══════════════════ مدير شركة أخرى ══════════════════
-- المكتبة عامة، فالمدير يقرؤها كالموظف — والمقصود إثبات أن القراءة
-- ليست امتيازًا تسرّب من شركة، وأن الكتابة ممنوعة عليه أيضًا.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_b_admin, true);

insert into public.test_results (category, name, passed, detail)
select 'المكتبة المرجعية', 'مدير شركة أخرى يقرأ المكتبة (ضابط موجب)',
       count(*) = 1, 'قرأ=' || count(*)
from public.platform_reference_documents
where id = 'ffffffff-0000-4000-8000-000000000001';

do $$
declare v_blocked boolean := false;
begin
  begin
    insert into public.platform_reference_documents (name, authority)
    values ('محاولة مدير شركة', 'جهة');
  exception when others then v_blocked := true;
  end;
  insert into public.test_results (category, name, passed, detail)
  values ('المكتبة المرجعية', 'مدير الشركة لا يكتب في المكتبة (ضابط سالب)',
          v_blocked, case when v_blocked then 'مُنع' else 'كَتَب — خرق' end);
end $$;

commit;

-- ══════════════════ لا تسرّب إلى استرجاع الشركات ══════════════════
-- أهمّ اختبارين في المجموعة.

insert into public.test_results (category, name, passed, detail)
select 'المكتبة المرجعية',
       'مقاطع المكتبة لم تدخل جدول مقاطع الشركات',
       count(*) = 0, 'تسرّب=' || count(*)
from public.document_chunks
where content like '%نصّ مرجعي%';

insert into public.test_results (category, name, passed, detail)
select 'المكتبة المرجعية',
       'دالّة استرجاع الشركات لا تذكر جداول المكتبة إطلاقًا',
       count(*) = 0, 'ذكرَتها=' || count(*)
from pg_proc
where proname = 'match_chunks_for_user'
  and prosrc like '%platform_reference%';

-- ودالّة المكتبة نفسها: لا تُرجع ما لم يُنشَر
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_a_hr_emp, true);

insert into public.test_results (category, name, passed, detail)
select 'المكتبة المرجعية',
       'استرجاع المكتبة يتجاهل الوثائق غير المنشورة',
       count(*) = 0, 'أرجع=' || count(*)
from public.match_platform_reference_chunks(
       array_fill(0.01::real, array[1024])::vector(1024), 20, 0.0)
where document_id = 'ffffffff-0000-4000-8000-000000000002';

commit;
