-- =====================================================================
-- بيانات اختبار العزل
--
-- تُنشأ بدور postgres (يتجاوز RLS) لتمثّل حالة قاعدة بيانات حقيقية
-- تضم شركتين. الاختبارات بعدها تعمل بدور authenticated فتخضع لـRLS
-- تمامًا كما يحدث لطلبات المستخدمين عبر PostgREST.
--
-- التصميم مقصود: كل مقاطع المستندات تحمل *المتجه نفسه*، فتتساوى درجة
-- التشابه بينها تمامًا. لو كان في العزل ثغرة، لعادت مقاطع الشركة
-- الأخرى حتمًا — لا يمكن للنتيجة الصحيحة أن تكون مصادفة.
-- =====================================================================

-- معرّفات ثابتة لتسهيل الإسناد في الاختبارات
\set company_a  '''aaaaaaaa-0000-4000-8000-000000000001'''
\set company_b  '''bbbbbbbb-0000-4000-8000-000000000001'''

\set dept_a_hr  '''aaaaaaaa-1000-4000-8000-000000000001'''
\set dept_a_fin '''aaaaaaaa-1000-4000-8000-000000000002'''
\set dept_b_hr  '''bbbbbbbb-1000-4000-8000-000000000001'''

\set user_a_admin  '''aaaaaaaa-2000-4000-8000-000000000001'''
\set user_a_hr_mgr '''aaaaaaaa-2000-4000-8000-000000000002'''
\set user_a_hr_emp '''aaaaaaaa-2000-4000-8000-000000000003'''
\set user_a_fin_emp '''aaaaaaaa-2000-4000-8000-000000000004'''
\set user_b_admin  '''bbbbbbbb-2000-4000-8000-000000000001'''

\set doc_a_public '''aaaaaaaa-3000-4000-8000-000000000001'''
\set doc_a_hr     '''aaaaaaaa-3000-4000-8000-000000000002'''
\set doc_a_admin  '''aaaaaaaa-3000-4000-8000-000000000003'''
\set doc_b_secret '''bbbbbbbb-3000-4000-8000-000000000001'''

\set plan_test  '''cccccccc-5000-4000-8000-000000000001'''
\set pay_a      '''aaaaaaaa-5000-4000-8000-000000000001'''
\set pay_b      '''bbbbbbbb-5000-4000-8000-000000000001'''

\set conv_a '''aaaaaaaa-4000-4000-8000-000000000001'''
\set conv_b '''bbbbbbbb-4000-4000-8000-000000000001'''

-- ---------- الشركات ----------

insert into public.companies (id, name, slug) values
  (:company_a::uuid, 'الشركة أ', 'company-a-test'),
  (:company_b::uuid, 'الشركة ب', 'company-b-test');

-- ---------- الأقسام ----------

insert into public.departments (id, company_id, name) values
  (:dept_a_hr::uuid,  :company_a::uuid, 'الموارد البشرية'),
  (:dept_a_fin::uuid, :company_a::uuid, 'المالية'),
  (:dept_b_hr::uuid,  :company_b::uuid, 'الموارد البشرية');

-- ---------- المستخدمون ----------
-- إدراج في auth.users يُشغّل المُحفِّز الذي ينشئ ملف profiles تلقائيًا

insert into auth.users (id, email) values
  (:user_a_admin::uuid,   'a.admin@test.invalid'),
  (:user_a_hr_mgr::uuid,  'a.hr.manager@test.invalid'),
  (:user_a_hr_emp::uuid,  'a.hr.employee@test.invalid'),
  (:user_a_fin_emp::uuid, 'a.fin.employee@test.invalid'),
  (:user_b_admin::uuid,   'b.admin@test.invalid');

update public.profiles set
  company_id = :company_a::uuid, department_id = null,
  role = 'COMPANY_ADMIN', status = 'ACTIVE', full_name = 'مدير الشركة أ'
where id = :user_a_admin::uuid;

update public.profiles set
  company_id = :company_a::uuid, department_id = :dept_a_hr::uuid,
  role = 'MANAGER', status = 'ACTIVE', full_name = 'مدير موارد بشرية أ'
where id = :user_a_hr_mgr::uuid;

update public.profiles set
  company_id = :company_a::uuid, department_id = :dept_a_hr::uuid,
  role = 'EMPLOYEE', status = 'ACTIVE', full_name = 'موظف موارد بشرية أ'
where id = :user_a_hr_emp::uuid;

update public.profiles set
  company_id = :company_a::uuid, department_id = :dept_a_fin::uuid,
  role = 'EMPLOYEE', status = 'ACTIVE', full_name = 'موظف مالية أ'
where id = :user_a_fin_emp::uuid;

update public.profiles set
  company_id = :company_b::uuid, department_id = :dept_b_hr::uuid,
  role = 'COMPANY_ADMIN', status = 'ACTIVE', full_name = 'مدير الشركة ب'
where id = :user_b_admin::uuid;

-- ---------- المستندات ----------

insert into public.documents
  (id, company_id, name, file_type, file_size_bytes, status, visibility,
   allowed_department_ids, allowed_roles, uploaded_by)
values
  -- متاح لكل موظفي الشركة أ
  (:doc_a_public::uuid, :company_a::uuid, 'دليل الموظف — الشركة أ',
   'text/plain', 100, 'READY', 'COMPANY', '{}', '{}', :user_a_admin::uuid),

  -- مقيّد بقسم الموارد البشرية في الشركة أ
  (:doc_a_hr::uuid, :company_a::uuid, 'ملف رواتب الموارد البشرية — الشركة أ',
   'text/plain', 100, 'READY', 'DEPARTMENT',
   array[:dept_a_hr::uuid], '{}', :user_a_admin::uuid),

  -- مقيّد بدور مدير الشركة
  (:doc_a_admin::uuid, :company_a::uuid, 'خطة الاستحواذ السرية — الشركة أ',
   'text/plain', 100, 'READY', 'ROLE',
   '{}', array['COMPANY_ADMIN']::user_role[], :user_a_admin::uuid),

  -- مستند الشركة ب
  (:doc_b_secret::uuid, :company_b::uuid, 'عقود عملاء — الشركة ب',
   'text/plain', 100, 'READY', 'COMPANY', '{}', '{}', :user_b_admin::uuid);

-- ---------- المقاطع والمتجهات ----------
-- المتجه نفسه للجميع ⇒ تشابه متطابق ⇒ لا مجال لنتيجة صحيحة بالمصادفة

insert into public.document_chunks
  (company_id, document_id, chunk_index, content, embedding)
values
  (:company_a::uuid, :doc_a_public::uuid, 0,
   'محتوى عام للشركة أ: ساعات العمل من 9 صباحًا حتى 5 مساءً.',
   ('[1' || repeat(',0', 1023) || ']')::vector(1024)),

  (:company_a::uuid, :doc_a_hr::uuid, 0,
   'سري للموارد البشرية بالشركة أ: سلّم رواتب الإدارة التنفيذية.',
   ('[1' || repeat(',0', 1023) || ']')::vector(1024)),

  (:company_a::uuid, :doc_a_admin::uuid, 0,
   'سري لمدير الشركة أ: تفاصيل صفقة الاستحواذ المقترحة.',
   ('[1' || repeat(',0', 1023) || ']')::vector(1024)),

  (:company_b::uuid, :doc_b_secret::uuid, 0,
   'سري للشركة ب: قائمة عملاء الشركة ب وقيم عقودهم.',
   ('[1' || repeat(',0', 1023) || ']')::vector(1024));

-- ---------- المحادثات والرسائل ----------

insert into public.conversations (id, company_id, user_id, title) values
  (:conv_a::uuid, :company_a::uuid, :user_a_admin::uuid, 'محادثة الشركة أ'),
  (:conv_b::uuid, :company_b::uuid, :user_b_admin::uuid, 'محادثة الشركة ب');

insert into public.messages (company_id, conversation_id, user_id, role, content) values
  (:company_a::uuid, :conv_a::uuid, :user_a_admin::uuid, 'USER', 'سؤال داخلي للشركة أ'),
  (:company_b::uuid, :conv_b::uuid, :user_b_admin::uuid, 'USER', 'سؤال داخلي للشركة ب');

-- ---------- فجوات المعرفة ----------

insert into public.knowledge_gaps (company_id, question, normalized_question) values
  (:company_a::uuid, 'فجوة معرفة تخص الشركة أ', 'gap company a'),
  (:company_b::uuid, 'فجوة معرفة تخص الشركة ب', 'gap company b');

-- ---------- سائلو الفجوات والتنبيهات ----------
-- تحمل هذه الجداول بيانات شركة، فتحتاج إثبات عزل كسواها. والتنبيه شخصي
-- فوق كونه شركيًا: لا يكفي ألّا يراه موظف شركة أخرى، بل لا يراه زميله.

insert into public.knowledge_gap_askers (gap_id, user_id, company_id)
select g.id, :user_a_hr_emp::uuid, :company_a::uuid
from public.knowledge_gaps g where g.normalized_question = 'gap company a';

insert into public.knowledge_gap_askers (gap_id, user_id, company_id)
select g.id, :user_b_admin::uuid, :company_b::uuid
from public.knowledge_gaps g where g.normalized_question = 'gap company b';

insert into public.notifications (company_id, user_id, type, title, body) values
  (:company_a::uuid, :user_a_hr_emp::uuid, 'GAP_ANSWERED',
   'تنبيه موظف الموارد البشرية — الشركة أ', 'سؤالك صار له إجابة'),
  (:company_a::uuid, :user_a_fin_emp::uuid, 'GAP_ANSWERED',
   'تنبيه موظف المالية — الشركة أ', 'سؤالك صار له إجابة'),
  (:company_b::uuid, :user_b_admin::uuid, 'GAP_ANSWERED',
   'تنبيه مدير الشركة ب', 'سؤالك صار له إجابة');

-- ---------- روابط واتساب ----------
-- ربط موثّق لموظف الموارد البشرية في الشركة أ، وآخر لمدير الشركة ب.

insert into public.whatsapp_links (company_id, user_id, phone, verified_at) values
  (:company_a::uuid, :user_a_hr_emp::uuid, '966500000001', now()),
  (:company_b::uuid, :user_b_admin::uuid,  '966500000002', now());

-- ---------- تذاكر الدعم ----------

insert into public.support_tickets (id, company_id, created_by, subject) values
  ('aaaaaaaa-7000-4000-8000-000000000001'::uuid, :company_a::uuid, :user_a_hr_emp::uuid,
   'تذكرة الشركة أ'),
  ('bbbbbbbb-7000-4000-8000-000000000001'::uuid, :company_b::uuid, :user_b_admin::uuid,
   'تذكرة الشركة ب — سرّية');

insert into public.support_messages (ticket_id, company_id, author_id, from_platform, body) values
  ('aaaaaaaa-7000-4000-8000-000000000001'::uuid, :company_a::uuid, :user_a_hr_emp::uuid, false,
   'نص مشكلة الشركة أ'),
  ('bbbbbbbb-7000-4000-8000-000000000001'::uuid, :company_b::uuid, :user_b_admin::uuid, false,
   'نص مشكلة الشركة ب — سرّي');

-- ---------- ملفات التخزين ----------

insert into storage.objects (bucket_id, name) values
  ('documents', :company_a::uuid || '/' || :doc_a_public::uuid || '/a.txt'),
  ('documents', :company_b::uuid || '/' || :doc_b_secret::uuid || '/b.txt');

-- ---------- جدول نتائج الاختبار ----------

create table if not exists public.test_results (
  id       serial primary key,
  category text not null,
  name     text not null,
  passed   boolean not null,
  detail   text
);

grant all on public.test_results to authenticated, anon;
grant all on sequence public.test_results_id_seq to authenticated, anon;

-- ---------- مساعدات تسجيل النتائج ----------
-- محاولة كتابة عبر الحدود قد تُرفض بإحدى صورتين: صفر صفوف متأثرة
-- (سياسة USING لا تطابق) أو خطأ صريح (سياسة WITH CHECK). كلاهما نجاح.
-- الالتقاط داخل كتلة exception يمنع إجهاض المعاملة فتكمل بقية الاختبارات.
-- الدالة بصلاحيات المُستدعي (security invoker) فتبقى RLS سارية عليها.

-- ---------- الفوترة: خطة واشتراكان ودفعتان ----------
-- الدفعة سجلّ مالي: تراها إدارة الشركة صاحبته وحدها. ووجود دفعة لكل
-- شركة شرطٌ لاختبار العزل — بلا نظير في الشركة الأخرى يصير «لا يرى
-- شيئًا» نتيجةً فارغة لا دليلًا.

insert into public.plans (id, code, name, price_amount, currency, billing_interval, is_public)
values (:plan_test::uuid, 'TESTPLAN', 'خطة اختبار', 499, 'SAR', 'MONTHLY', true)
on conflict (id) do nothing;

insert into public.subscriptions (company_id, plan_id, status)
values (:company_a::uuid, :plan_test::uuid, 'ACTIVE'),
       (:company_b::uuid, :plan_test::uuid, 'ACTIVE')
on conflict (company_id) do nothing;

insert into public.payments
  (id, company_id, plan_id, provider_payment_id, amount_halalas, currency, status)
values
  (:pay_a::uuid, :company_a::uuid, :plan_test::uuid, 'pay_fixture_a', 49900, 'SAR', 'PAID'),
  (:pay_b::uuid, :company_b::uuid, :plan_test::uuid, 'pay_fixture_b', 49900, 'SAR', 'PAID')
on conflict (id) do nothing;

-- ---------- محتوى الموقع ----------
-- صفّ واحد يكفي: بدونه يمرّ «الزائر يقرأ» على جدول فارغ فلا يثبت شيئًا.

insert into public.site_content (key, value)
values ('home.badge', 'نصّ تجريبي للاختبار')
on conflict (key) do nothing;

-- ---------- صفحات الموقع ----------
-- منشورة ومسوّدة معًا: الاختبار المهمّ ليس أن المنشورة تُقرأ، بل أن
-- المسوّدة **لا** تُقرأ. ولو غابت المسوّدة من التركيبات لمرّ الفحص على
-- لا شيء وأثبت لا شيء.

insert into public.site_pages (id, slug, title, body, status, show_in_nav)
values
  ('cccccccc-4000-4000-8000-000000000001'::uuid,
   'صفحة-منشورة', 'صفحة منشورة للاختبار', 'نصّ ظاهر', 'PUBLISHED', true),
  ('cccccccc-4000-4000-8000-000000000002'::uuid,
   'صفحة-مسودة', 'صفحة مسوّدة للاختبار', 'نصّ مخفيّ', 'DRAFT', false)
on conflict (id) do nothing;

create or replace function public.record_write_attempt(
  p_category text,
  p_name     text,
  p_sql      text
) returns void
language plpgsql
as $$
declare
  v_rows    bigint  := 0;
  v_blocked boolean := false;
  v_error   text;
begin
  begin
    execute p_sql;
    get diagnostics v_rows = row_count;
  exception when others then
    v_blocked := true;
    v_error := sqlerrm;
  end;

  insert into public.test_results (category, name, passed, detail)
  values (
    p_category,
    p_name,
    v_blocked or v_rows = 0,
    case
      when v_blocked then 'رُفض بخطأ: ' || split_part(v_error, E'\n', 1)
      else 'صفوف متأثرة: ' || v_rows
    end
  );
end;
$$;

-- استعلام قد يُرفض بخطأ بدل أن يُرجع صفرًا (مثل match_document_chunks
-- التي ترفع unauthorized للحساب المعطّل). الرفض بخطأ نجاح أيضًا.
create or replace function public.record_zero_rows_expected(
  p_category text,
  p_name     text,
  p_sql      text
) returns void
language plpgsql
as $$
declare
  v_count   bigint  := -1;
  v_blocked boolean := false;
  v_error   text;
begin
  begin
    execute 'select count(*) from (' || p_sql || ') as q' into v_count;
  exception when others then
    v_blocked := true;
    v_error := sqlerrm;
  end;

  insert into public.test_results (category, name, passed, detail)
  values (
    p_category,
    p_name,
    v_blocked or v_count = 0,
    case
      when v_blocked then 'رُفض بخطأ: ' || split_part(v_error, E'\n', 1)
      else 'الصفوف العائدة: ' || v_count
    end
  );
end;
$$;

grant execute on function public.record_write_attempt(text, text, text) to authenticated, anon;
grant execute on function public.record_zero_rows_expected(text, text, text) to authenticated, anon;
