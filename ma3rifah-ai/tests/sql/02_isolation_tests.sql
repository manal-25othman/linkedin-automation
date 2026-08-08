-- =====================================================================
-- اختبارات العزل — تُنفَّذ بدور authenticated فتخضع لـRLS بالكامل
--
-- كل كتلة تُحاكي طلبًا حقيقيًا من مستخدم بعينه:
--   set local role authenticated;              -- الدور الذي تستخدمه Supabase
--   set local request.jwt.claims = '{"sub":…}' -- ما تضعه بوابة PostgREST من الـJWT
--
-- المجموعة الأولى: العزل بين الشركات.
-- المجموعة الثانية: صلاحيات المستند داخل الشركة الواحدة، بما فيها
--                   منع تسرّب المقاطع الممنوعة إلى سياق RAG.
-- =====================================================================

\set user_a_admin   '''aaaaaaaa-2000-4000-8000-000000000001'''
\set user_a_hr_mgr  '''aaaaaaaa-2000-4000-8000-000000000002'''
\set user_a_hr_emp  '''aaaaaaaa-2000-4000-8000-000000000003'''
\set user_a_fin_emp '''aaaaaaaa-2000-4000-8000-000000000004'''
\set user_b_admin   '''bbbbbbbb-2000-4000-8000-000000000001'''

\set company_a  '''aaaaaaaa-0000-4000-8000-000000000001'''
\set company_b  '''bbbbbbbb-0000-4000-8000-000000000001'''
\set dept_b_hr  '''bbbbbbbb-1000-4000-8000-000000000001'''

\set doc_a_public '''aaaaaaaa-3000-4000-8000-000000000001'''
\set doc_a_hr     '''aaaaaaaa-3000-4000-8000-000000000002'''
\set doc_a_admin  '''aaaaaaaa-3000-4000-8000-000000000003'''
\set doc_b_secret '''bbbbbbbb-3000-4000-8000-000000000001'''

-- المتجه المستخدم في كل اختبارات البحث الدلالي — مطابق تمامًا لمتجهات
-- كل المقاطع، فتتساوى درجة التشابه ولا يمكن لنتيجة صحيحة أن تكون مصادفة.
-- يُكتب صراحةً في كل استعلام لأن \set في psql استبدال نصي لا يُقيّم SQL.

-- =====================================================================
-- المجموعة 1 — العزل بين الشركات (بعين مدير الشركة أ)
-- =====================================================================

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-2000-4000-8000-000000000001"}';

insert into public.test_results (category, name, passed, detail)
select 'عزل المستأجرين', 'لا يرى الشركة ب في جدول الشركات',
       count(*) = 1 and bool_and(id = :company_a::uuid),
       'عدد الشركات المرئية: ' || count(*)
from public.companies;

insert into public.test_results (category, name, passed, detail)
select 'عزل المستأجرين', 'لا يرى مستندات الشركة ب',
       count(*) filter (where company_id <> :company_a::uuid) = 0,
       'مستندات مرئية: ' || count(*) || ' — منها خارج شركته: '
         || count(*) filter (where company_id <> :company_a::uuid)
from public.documents;

insert into public.test_results (category, name, passed, detail)
select 'عزل المستأجرين', 'تمرير معرّف مستند الشركة ب صراحةً لا يُرجع شيئًا',
       count(*) = 0, 'الصفوف العائدة: ' || count(*)
from public.documents where id = :doc_b_secret::uuid;

insert into public.test_results (category, name, passed, detail)
select 'عزل المستأجرين', 'لا يقرأ مقاطع مستندات الشركة ب',
       count(*) filter (where company_id <> :company_a::uuid) = 0,
       'مقاطع خارج شركته: ' || count(*) filter (where company_id <> :company_a::uuid)
from public.document_chunks;

-- الاختبار الحاسم: البحث الدلالي بمتجه مطابق لكل المقاطع
insert into public.test_results (category, name, passed, detail)
select 'عزل المستأجرين', 'البحث الدلالي (RAG) لا يعبر حدود الشركة',
       count(*) > 0 and count(*) filter (where document_id = :doc_b_secret::uuid) = 0,
       'مقاطع مسترجعة: ' || count(*) || ' — من الشركة ب: '
         || count(*) filter (where document_id = :doc_b_secret::uuid)
from public.match_document_chunks(('[1' || repeat(',0', 1023) || ']')::vector(1024), 20, 0.0, null);

insert into public.test_results (category, name, passed, detail)
select 'عزل المستأجرين', 'لا يرى محادثات الشركة ب',
       count(*) filter (where company_id <> :company_a::uuid) = 0,
       'محادثات خارج شركته: ' || count(*) filter (where company_id <> :company_a::uuid)
from public.conversations;

insert into public.test_results (category, name, passed, detail)
select 'عزل المستأجرين', 'لا يرى رسائل الشركة ب',
       count(*) filter (where company_id <> :company_a::uuid) = 0,
       'رسائل خارج شركته: ' || count(*) filter (where company_id <> :company_a::uuid)
from public.messages;

insert into public.test_results (category, name, passed, detail)
select 'عزل المستأجرين', 'لا يرى فجوات معرفة الشركة ب',
       count(*) filter (where company_id <> :company_a::uuid) = 0,
       'فجوات خارج شركته: ' || count(*) filter (where company_id <> :company_a::uuid)
from public.knowledge_gaps;

insert into public.test_results (category, name, passed, detail)
select 'عزل المستأجرين', 'لا يرى مستخدمي الشركة ب',
       count(*) filter (where company_id <> :company_a::uuid) = 0,
       'مستخدمون مرئيون: ' || count(*) || ' — خارج شركته: '
         || count(*) filter (where company_id <> :company_a::uuid)
from public.profiles;

insert into public.test_results (category, name, passed, detail)
select 'عزل المستأجرين', 'لا يرى أقسام الشركة ب',
       count(*) filter (where company_id <> :company_a::uuid) = 0,
       'أقسام خارج شركته: ' || count(*) filter (where company_id <> :company_a::uuid)
from public.departments;

insert into public.test_results (category, name, passed, detail)
select 'عزل المستأجرين', 'إحصاءات لوحة التحكم محصورة بشركته',
       documents_count = 3 and users_count = 4,
       'مستندات: ' || documents_count || ' · مستخدمون: ' || users_count
         || ' (المتوقع 3 و4)'
from public.company_dashboard_stats();

insert into public.test_results (category, name, passed, detail)
select 'عزل المستأجرين', 'أكثر المستندات استخدامًا محصورة بشركته',
       count(*) filter (where document_id = :doc_b_secret::uuid) = 0,
       'مستندات الشركة ب في التقرير: '
         || count(*) filter (where document_id = :doc_b_secret::uuid)
from public.company_top_documents(20);

commit;

-- ---------- محاولات الكتابة عبر الحدود ----------

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-2000-4000-8000-000000000001"}';

select public.record_write_attempt(
  'عزل المستأجرين', 'لا يستطيع تعديل مستند الشركة ب',
  $q$update public.documents set name = 'اسم مخترق'
     where id = 'bbbbbbbb-3000-4000-8000-000000000001'::uuid$q$);

select public.record_write_attempt(
  'عزل المستأجرين', 'لا يستطيع حذف مستند الشركة ب',
  $q$delete from public.documents
     where id = 'bbbbbbbb-3000-4000-8000-000000000001'::uuid$q$);

select public.record_write_attempt(
  'عزل المستأجرين', 'لا يستطيع حذف مقاطع الشركة ب',
  $q$delete from public.document_chunks
     where company_id = 'bbbbbbbb-0000-4000-8000-000000000001'::uuid$q$);

select public.record_write_attempt(
  'عزل المستأجرين', 'لا يستطيع حذف محادثات الشركة ب',
  $q$delete from public.conversations
     where company_id = 'bbbbbbbb-0000-4000-8000-000000000001'::uuid$q$);

select public.record_write_attempt(
  'عزل المستأجرين', 'لا يستطيع تعديل فجوات معرفة الشركة ب',
  $q$update public.knowledge_gaps set status = 'RESOLVED'
     where company_id = 'bbbbbbbb-0000-4000-8000-000000000001'::uuid$q$);

select public.record_write_attempt(
  'عزل المستأجرين', 'لا يستطيع تعطيل مستخدم في الشركة ب',
  $q$update public.profiles set status = 'DISABLED'
     where company_id = 'bbbbbbbb-0000-4000-8000-000000000001'::uuid$q$);

select public.record_write_attempt(
  'عزل المستأجرين', 'لا يستطيع نقل نفسه إلى الشركة ب',
  $q$update public.profiles
     set company_id = 'bbbbbbbb-0000-4000-8000-000000000001'::uuid
     where id = 'aaaaaaaa-2000-4000-8000-000000000001'::uuid$q$);

select public.record_write_attempt(
  'عزل المستأجرين', 'لا يستطيع إدراج قسم باسم الشركة ب',
  $q$insert into public.departments (company_id, name)
     values ('bbbbbbbb-0000-4000-8000-000000000001'::uuid, 'قسم مزروع')$q$);

select public.record_write_attempt(
  'عزل المستأجرين', 'لا يستطيع زرع مستند في الشركة ب',
  $q$insert into public.documents
       (company_id, name, file_type, file_size_bytes, uploaded_by)
     values ('bbbbbbbb-0000-4000-8000-000000000001'::uuid, 'مستند مزروع',
             'text/plain', 10, 'aaaaaaaa-2000-4000-8000-000000000001'::uuid)$q$);

select public.record_write_attempt(
  'تصعيد الصلاحيات', 'لا يستطيع ترقية نفسه إلى مدير منصة',
  $q$update public.profiles set role = 'SUPER_ADMIN'
     where id = 'aaaaaaaa-2000-4000-8000-000000000001'::uuid$q$);

commit;

-- تحقق مستقل: بيانات الشركة ب لم تتأثر فعليًا (بدور postgres)
insert into public.test_results (category, name, passed, detail)
select 'عزل المستأجرين', 'التحقق المقابل: مستند الشركة ب سليم ولم يُمس',
       count(*) = 1 and bool_and(name = 'عقود عملاء — الشركة ب'),
       'الاسم الحالي: ' || coalesce(max(name), 'محذوف')
from public.documents where id = 'bbbbbbbb-3000-4000-8000-000000000001'::uuid;

insert into public.test_results (category, name, passed, detail)
select 'عزل المستأجرين', 'التحقق المقابل: بيانات الشركة ب لم يُزرع فيها شيء',
       docs = 1 and depts = 1 and chunks = 1 and convs = 1 and gaps = 1,
       'مستندات: ' || docs || ' · أقسام: ' || depts || ' · مقاطع: ' || chunks
         || ' · محادثات: ' || convs || ' · فجوات: ' || gaps
         || ' (المتوقع 1 لكلٍّ منها)'
from (
  select
    (select count(*) from public.documents        where company_id = 'bbbbbbbb-0000-4000-8000-000000000001'::uuid) docs,
    (select count(*) from public.departments      where company_id = 'bbbbbbbb-0000-4000-8000-000000000001'::uuid) depts,
    (select count(*) from public.document_chunks  where company_id = 'bbbbbbbb-0000-4000-8000-000000000001'::uuid) chunks,
    (select count(*) from public.conversations    where company_id = 'bbbbbbbb-0000-4000-8000-000000000001'::uuid) convs,
    (select count(*) from public.knowledge_gaps   where company_id = 'bbbbbbbb-0000-4000-8000-000000000001'::uuid) gaps
) t;

insert into public.test_results (category, name, passed, detail)
select 'عزل المستأجرين', 'التحقق المقابل: مستخدمو الشركة ب ما زالوا نشطين',
       count(*) = 1 and bool_and(status = 'ACTIVE'),
       'مستخدمون: ' || count(*) || ' · غير نشط: '
         || count(*) filter (where status <> 'ACTIVE')
from public.profiles where company_id = 'bbbbbbbb-0000-4000-8000-000000000001'::uuid;

insert into public.test_results (category, name, passed, detail)
select 'تصعيد الصلاحيات', 'التحقق المقابل: دور المستخدم لم يتغيّر',
       bool_and(role = 'COMPANY_ADMIN' and company_id = 'aaaaaaaa-0000-4000-8000-000000000001'::uuid),
       'الدور: ' || max(role::text)
from public.profiles where id = 'aaaaaaaa-2000-4000-8000-000000000001'::uuid;

-- =====================================================================
-- المجموعة 2 — صلاحيات المستند داخل الشركة الواحدة
-- =====================================================================

-- (أ) موظف المالية: لا يرى مستند الموارد البشرية المقيّد بالقسم
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-2000-4000-8000-000000000004"}';

insert into public.test_results (category, name, passed, detail)
select 'صلاحيات المستندات', 'موظف المالية لا يقرأ مستند الموارد البشرية (تقييد بالقسم)',
       count(*) = 0, 'الصفوف العائدة: ' || count(*)
from public.documents where id = :doc_a_hr::uuid;

insert into public.test_results (category, name, passed, detail)
select 'صلاحيات المستندات', 'موظف المالية لا يقرأ المستند المقيّد بدور مدير الشركة',
       count(*) = 0, 'الصفوف العائدة: ' || count(*)
from public.documents where id = :doc_a_admin::uuid;

insert into public.test_results (category, name, passed, detail)
select 'صلاحيات المستندات', 'موظف المالية يقرأ المستند المتاح للشركة (ضابط موجب)',
       count(*) = 1, 'الصفوف العائدة: ' || count(*)
from public.documents where id = :doc_a_public::uuid;

-- الاختبار الأهم: هل يتسرّب المقطع الممنوع إلى سياق RAG؟
insert into public.test_results (category, name, passed, detail)
select 'صلاحيات المستندات',
       'سياق RAG لموظف المالية يستثني مستند الموارد البشرية والمستند الإداري',
       count(*) = 1 and bool_and(document_id = :doc_a_public::uuid),
       'مقاطع مسترجعة: ' || count(*) || ' — المستندات: ' ||
         coalesce(string_agg(distinct document_name, '، '), 'لا شيء')
from public.match_document_chunks(('[1' || repeat(',0', 1023) || ']')::vector(1024), 20, 0.0, null);

insert into public.test_results (category, name, passed, detail)
select 'صلاحيات المستندات', 'موظف المالية لا يقرأ مقاطع المستندات الممنوعة مباشرةً',
       count(*) = 1, 'مقاطع مرئية: ' || count(*) || ' (المتوقع 1)'
from public.document_chunks;

commit;

-- (ب) مدير الموارد البشرية: يرى مستند قسمه ولا يرى المستند الإداري
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-2000-4000-8000-000000000002"}';

insert into public.test_results (category, name, passed, detail)
select 'صلاحيات المستندات', 'مدير الموارد البشرية يقرأ مستند قسمه (ضابط موجب)',
       count(*) = 1, 'الصفوف العائدة: ' || count(*)
from public.documents where id = :doc_a_hr::uuid;

insert into public.test_results (category, name, passed, detail)
select 'صلاحيات المستندات', 'مدير الموارد البشرية لا يقرأ المستند المقيّد بدور مدير الشركة',
       count(*) = 0, 'الصفوف العائدة: ' || count(*)
from public.documents where id = :doc_a_admin::uuid;

insert into public.test_results (category, name, passed, detail)
select 'صلاحيات المستندات',
       'سياق RAG لمدير الموارد البشرية يشمل مستند قسمه ويستثني الإداري',
       count(*) = 2
         and count(*) filter (where document_id = :doc_a_hr::uuid) = 1
         and count(*) filter (where document_id = :doc_a_admin::uuid) = 0,
       'مقاطع مسترجعة: ' || count(*) || ' — المستندات: ' ||
         coalesce(string_agg(distinct document_name, '، '), 'لا شيء')
from public.match_document_chunks(('[1' || repeat(',0', 1023) || ']')::vector(1024), 20, 0.0, null);

commit;

-- (ج) مدير الشركة: يرى كل مستندات شركته فقط
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-2000-4000-8000-000000000001"}';

insert into public.test_results (category, name, passed, detail)
select 'صلاحيات المستندات', 'مدير الشركة يقرأ كل مستندات شركته الثلاثة (ضابط موجب)',
       count(*) = 3, 'الصفوف العائدة: ' || count(*)
from public.documents;

insert into public.test_results (category, name, passed, detail)
select 'صلاحيات المستندات', 'سياق RAG لمدير الشركة = 3 مقاطع من شركته فقط',
       count(*) = 3 and count(*) filter (where document_id = :doc_b_secret::uuid) = 0,
       'مقاطع مسترجعة: ' || count(*)
from public.match_document_chunks(('[1' || repeat(',0', 1023) || ']')::vector(1024), 20, 0.0, null);

commit;

-- (د) الحساب المعطّل يفقد كل وصول
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-2000-4000-8000-000000000004"}';
savepoint before_disable;
commit;

update public.profiles set status = 'DISABLED'
where id = 'aaaaaaaa-2000-4000-8000-000000000004'::uuid;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-2000-4000-8000-000000000004"}';

insert into public.test_results (category, name, passed, detail)
select 'إبطال الوصول', 'الحساب المعطّل لا يقرأ أي مستند',
       count(*) = 0, 'الصفوف العائدة: ' || count(*)
from public.documents;

-- الدالة ترفع unauthorized للحساب غير النشط بدل أن تُرجع صفرًا؛ كلاهما نجاح
select public.record_zero_rows_expected(
  'إبطال الوصول', 'الحساب المعطّل لا يسترجع أي سياق RAG',
  $q$select * from public.match_document_chunks(
       ('[1' || repeat(',0', 1023) || ']')::vector(1024), 20, 0.0, null)$q$);

commit;

update public.profiles set status = 'ACTIVE'
where id = 'aaaaaaaa-2000-4000-8000-000000000004'::uuid;

-- (هـ) مستخدم بلا جلسة (anon) لا يصل إلى شيء
begin;
set local role anon;

insert into public.test_results (category, name, passed, detail)
select 'إبطال الوصول', 'زائر بلا جلسة لا يرى أي مستند',
       count(*) = 0, 'الصفوف العائدة: ' || count(*)
from public.documents;

insert into public.test_results (category, name, passed, detail)
select 'إبطال الوصول', 'زائر بلا جلسة لا يرى أي شركة',
       count(*) = 0, 'الصفوف العائدة: ' || count(*)
from public.companies;

commit;

-- =====================================================================
-- المجموعة 3 — عزل التخزين
-- =====================================================================

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-2000-4000-8000-000000000001"}';

insert into public.test_results (category, name, passed, detail)
select 'عزل التخزين', 'لا يرى ملفات الشركة ب في التخزين',
       count(*) = 1 and bool_and(name like :company_a || '/%'),
       'ملفات مرئية: ' || count(*) || ' (المتوقع 1)'
from storage.objects where bucket_id = 'documents';

commit;

-- =====================================================================
-- المجموعة 4 — حراسة دالة البذور
-- =====================================================================

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-2000-4000-8000-000000000004"}';

do $$
declare
  blocked boolean := false;
begin
  begin
    perform * from public.seed_match_chunks(
      'bbbbbbbb-0000-4000-8000-000000000001'::uuid,
      ('[1' || repeat(',0', 1023) || ']')::vector(1024), 10);
  exception when insufficient_privilege or others then
    blocked := true;
  end;

  insert into public.test_results (category, name, passed, detail)
  values ('عزل المستأجرين',
          'دالة البذور seed_match_chunks محجوبة عن المستخدمين العاديين',
          blocked,
          case when blocked then 'رُفض التنفيذ — الصلاحية لـservice_role فقط'
               else 'نُفّذت — ثغرة خطيرة' end);
end $$;

commit;
