-- =====================================================================
-- المجموعة ١٢ — مساحة الخبراء (0038)
-- =====================================================================
-- الادّعاء الذي تُثبته هذه المجموعة: الإسناد يفتح للخبير **صفَّه هو**
-- ولا يفتح له الجدول. وأخطر ما في الميزة أن توسيع القراءة يُوسَّع
-- سهوًا إلى الكتابة، أو أن يُقرأ صفٌّ من شركة أخرى لأن شرط الشركة
-- سقط أمام شرط الإسناد.

\set company_a  '''aaaaaaaa-0000-4000-8000-000000000001'''
\set company_b  '''bbbbbbbb-0000-4000-8000-000000000001'''
\set user_a_admin   '''aaaaaaaa-2000-4000-8000-000000000001'''
\set user_a_hr_emp  '''aaaaaaaa-2000-4000-8000-000000000003'''
\set user_a_fin_emp '''aaaaaaaa-2000-4000-8000-000000000004'''
\set user_b_admin   '''bbbbbbbb-2000-4000-8000-000000000001'''

-- الشركة أ تُسنِد فجوتها إلى موظف الموارد البشرية (بمفتاح الخدمة)
update public.knowledge_gaps
set assigned_to = :user_a_hr_emp::uuid,
    assigned_by = :user_a_admin::uuid,
    assigned_at = now()
where normalized_question = 'gap company a';

-- والشركة ب تُسنِد فجوتها إلى **موظف الشركة أ** — إسناد فاسد لا يقع
-- من الواجهة، وغرضه هنا إثبات أن شرط الشركة يمنعه ولو وقع
update public.knowledge_gaps
set assigned_to = :user_a_hr_emp::uuid,
    assigned_at = now()
where normalized_question = 'gap company b';

-- ══════════════════ الخبير المُسنَد إليه ══════════════════
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_a_hr_emp, true);

-- ضابط موجب: يرى الفجوة المُسنَدة إليه
insert into public.test_results (category, name, passed, detail)
select 'مساحة الخبراء', 'الخبير يرى الفجوة المُسنَدة إليه (ضابط موجب)',
       count(*) = 1, 'رأى=' || count(*)
from public.knowledge_gaps where normalized_question = 'gap company a';

-- ولا يرى غيرها: فجوة شركة ب مُسنَدة إليه في الجدول، والشركة تمنع
insert into public.test_results (category, name, passed, detail)
select 'مساحة الخبراء', 'الإسناد لا يخترق حدّ الشركة',
       count(*) = 0, 'رأى=' || count(*)
from public.knowledge_gaps where normalized_question = 'gap company b';

-- ولا يكتب في الصفّ مباشرة: لا سياسة كتابة له، فالتحديث يمرّ بصفر صفوف
update public.knowledge_gaps set status = 'RESOLVED', answer_text = 'نشرتُه بنفسي'
where normalized_question = 'gap company a';

-- ولا يعيد إسنادها إلى نفسه في شركة أخرى
update public.knowledge_gaps set assigned_to = :user_a_fin_emp::uuid
where normalized_question = 'gap company a';

-- الدالّة هي طريقه الوحيد — ضابط موجب
select public.submit_expert_answer(
  (select id from public.knowledge_gaps where normalized_question = 'gap company a'),
  'مسوّدة الخبير: تُراجَع عهدة السلامة كل ستة أشهر ويوقّع مسؤول القسم.'
) as ok \gset
insert into public.test_results (category, name, passed, detail)
values ('مساحة الخبراء', 'الدالّة تقبل جواب المُسنَد إليه (ضابط موجب)', :'ok'::boolean, 'ok=' || :'ok');
commit;

insert into public.test_results (category, name, passed, detail)
select 'مساحة الخبراء', 'كتابة الخبير المباشرة لم تُنفَّذ',
       status <> 'RESOLVED' and answer_text is null,
       'status=' || status || ' answer=' || coalesce(answer_text, 'null')
from public.knowledge_gaps where normalized_question = 'gap company a';

insert into public.test_results (category, name, passed, detail)
select 'مساحة الخبراء', 'الخبير لم يستطع تغيير الإسناد',
       assigned_to = :user_a_hr_emp::uuid, 'assigned=' || coalesce(assigned_to::text, 'null')
from public.knowledge_gaps where normalized_question = 'gap company a';

insert into public.test_results (category, name, passed, detail)
select 'مساحة الخبراء', 'مسوّدة الخبير حُفظت في عمودها',
       expert_answer is not null and expert_answered_at is not null,
       'draft=' || coalesce(left(expert_answer, 20), 'null')
from public.knowledge_gaps where normalized_question = 'gap company a';

-- ══════════════════ زميل لم يُسنَد إليه شيء ══════════════════
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_a_fin_emp, true);

insert into public.test_results (category, name, passed, detail)
select 'مساحة الخبراء', 'موظف بلا إسناد لا يرى فجوات شركته',
       count(*) = 0, 'رأى=' || count(*)
from public.knowledge_gaps;

-- ولا يكتب على فجوة أُسنِدت إلى زميله عبر الدالّة
select public.submit_expert_answer(
  (select id from public.knowledge_gaps where normalized_question = 'gap company a'),
  'محاولة موظف لم يُسنَد إليه هذا السؤال إطلاقًا.'
) as ok2 \gset
insert into public.test_results (category, name, passed, detail)
values ('مساحة الخبراء', 'الدالّة ترفض من لم يُسنَد إليه',
        :'ok2'::boolean is false, 'ok=' || :'ok2');
commit;

insert into public.test_results (category, name, passed, detail)
select 'مساحة الخبراء', 'مسوّدة الزميل لم تُكتب فوق مسوّدة الخبير',
       expert_answer like 'مسوّدة الخبير%', 'draft=' || coalesce(left(expert_answer, 20), 'null')
from public.knowledge_gaps where normalized_question = 'gap company a';

-- ══════════════════ مدير شركة أخرى ══════════════════
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_b_admin, true);

insert into public.test_results (category, name, passed, detail)
select 'مساحة الخبراء', 'مدير الشركة ب لا يرى فجوة الشركة أ',
       count(*) = 0, 'رأى=' || count(*)
from public.knowledge_gaps where normalized_question = 'gap company a';

select public.submit_expert_answer(
  (select id from public.knowledge_gaps where normalized_question = 'gap company a'),
  'محاولة مدير من شركة أخرى للكتابة على فجوة ليست له.'
) as ok3 \gset
insert into public.test_results (category, name, passed, detail)
values ('مساحة الخبراء', 'الدالّة ترفض مديرًا من شركة أخرى',
        :'ok3'::boolean is false, 'ok=' || :'ok3');
commit;

-- ══════════════════ مدير الشركة نفسها ══════════════════
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_a_admin, true);

insert into public.test_results (category, name, passed, detail)
select 'مساحة الخبراء', 'مدير الشركة يرى مسوّدة الخبير ليعتمدها (ضابط موجب)',
       count(*) = 1, 'رأى=' || count(*)
from public.knowledge_gaps
where normalized_question = 'gap company a' and expert_answer is not null;

-- ويعتمدها بالمسار القائم: الإجابة المعتمدة كتابةُ مديرٍ لا نسخُ مسوّدة
update public.knowledge_gaps set status = 'RESOLVED', answer_text = expert_answer
where normalized_question = 'gap company a';
commit;

insert into public.test_results (category, name, passed, detail)
select 'مساحة الخبراء', 'اعتماد المدير نفَذ (ضابط موجب)',
       status = 'RESOLVED' and answer_text is not null, 'status=' || status
from public.knowledge_gaps where normalized_question = 'gap company a';
