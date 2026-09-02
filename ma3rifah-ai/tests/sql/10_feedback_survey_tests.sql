-- =====================================================================
-- المجموعة ١١ — استبيان الرأي (0037)
-- =====================================================================
-- يقرأ المستخدم إجابته هو فقط، ولا يكتب باسم غيره ولا لشركة غيره،
-- ومالك المنصة يقرأ الكل.

-- إجابة مزروعة لمدير الشركة أ (بمفتاح الخدمة)
insert into public.feedback_surveys
  (company_id, user_id, role, overall_rating, found_answers, recommend_rating, most_useful)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2000-4000-8000-000000000001',
        'COMPANY_ADMIN', 4, 'MOSTLY', 5, 'سرّي — رأي مدير الشركة أ')
on conflict (user_id) do nothing;

-- ── موظف في الشركة أ نفسها ──
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-2000-4000-8000-000000000003', true);

insert into public.test_results (category, name, passed, detail)
select 'الاستبيان', 'موظف الشركة نفسها لا يقرأ إجابة مديره',
       count(*) = 0, 'رأى=' || count(*)
from public.feedback_surveys;

-- يكتب إجابته هو (ضابط موجب)
insert into public.feedback_surveys
  (company_id, user_id, role, overall_rating, found_answers, recommend_rating)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2000-4000-8000-000000000003',
        'EMPLOYEE', 3, 'SOMETIMES', 3);

insert into public.test_results (category, name, passed, detail)
select 'الاستبيان', 'الموظف يكتب إجابته ويقرؤها (ضابط موجب)',
       count(*) = 1, 'رأى=' || count(*)
from public.feedback_surveys where user_id = 'aaaaaaaa-2000-4000-8000-000000000003';

-- لا يكتب باسم زميله
do $$
begin
  begin
    insert into public.feedback_surveys
      (company_id, user_id, role, overall_rating, found_answers, recommend_rating)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-2000-4000-8000-000000000004',
            'EMPLOYEE', 1, 'RARELY', 1);
    insert into public.test_results (category, name, passed, detail)
    values ('الاستبيان', 'لا يكتب إجابة باسم زميله', false, 'كتبها!');
  exception when others then
    insert into public.test_results (category, name, passed, detail)
    values ('الاستبيان', 'لا يكتب إجابة باسم زميله', true, sqlstate);
  end;
end $$;

-- لا يعدّل إجابة مديره (التحديث يمرّ صامتًا بصفر صفوف)
update public.feedback_surveys set overall_rating = 1
where user_id = 'aaaaaaaa-2000-4000-8000-000000000001';
commit;

insert into public.test_results (category, name, passed, detail)
select 'الاستبيان', 'تحديث الموظف لإجابة مديره لم يُنفَّذ',
       overall_rating = 4, 'rating=' || overall_rating
from public.feedback_surveys where user_id = 'aaaaaaaa-2000-4000-8000-000000000001';

-- ── مدير الشركة ب ──
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-2000-4000-8000-000000000001', true);

insert into public.test_results (category, name, passed, detail)
select 'الاستبيان', 'مدير الشركة ب لا يقرأ إجابات الشركة أ',
       count(*) = 0, 'رأى=' || count(*)
from public.feedback_surveys;

do $$
begin
  begin
    -- يحاول الكتابة بمعرّف شركة أ باسمه هو
    insert into public.feedback_surveys
      (company_id, user_id, role, overall_rating, found_answers, recommend_rating)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-2000-4000-8000-000000000001',
            'COMPANY_ADMIN', 5, 'MOSTLY', 5);
    insert into public.test_results (category, name, passed, detail)
    values ('الاستبيان', 'لا يكتب إجابة منسوبة إلى شركة أخرى', false, 'كتبها!');
  exception when others then
    insert into public.test_results (category, name, passed, detail)
    values ('الاستبيان', 'لا يكتب إجابة منسوبة إلى شركة أخرى', true, sqlstate);
  end;
end $$;
commit;

-- ── مالك المنصة يقرأ الكل ──
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-2000-4000-8000-000000000001', true);

insert into public.test_results (category, name, passed, detail)
select 'الاستبيان', 'مالك المنصة يقرأ إجابات كل الشركات',
       count(*) >= 2, 'رأى=' || count(*)
from public.feedback_surveys;
commit;
