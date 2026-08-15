-- =====================================================================
-- 0018 — استرجاع أصحاب الأسئلة، وتثبيت دالة تسجيل الفجوة
--
-- العطل: يكتب المدير إجابةً لفجوة فلا يصل صاحبَ السؤال شيء. والسبب أن
-- جدول `knowledge_gap_askers` فارغ، فلا تجد المنصةُ أحدًا تُبلّغه.
--
-- ولذلك سببان مستقلّان:
--
--   ١) قواعد البيانات التي طُبِّق عليها الترحيل 0006 دون 0014 ما زالت
--      تحمل النسخة القديمة من `record_knowledge_gap` — وهي لا تسجّل
--      السائل إطلاقًا. يُعاد تعريف الدالة هنا لتثبيتها على النسخة
--      الصحيحة أيًّا كان ما سبق.
--
--   ٢) الفجوات المسجّلة قبل ذلك لا سائل لها ولن يكون لها أبدًا — فلا
--      يكفي إصلاح المستقبل. تُستخرج أصحابها هنا من الرسائل نفسها:
--      `messages.user_id` يحمل صاحب كل سؤال، والمطابقة على الصيغة
--      المعيارية للسؤال هي المطابقة عينها التي أنشأت الفجوة، فلا تخمين
--      فيها.
--
-- والترحيل كله قابل لإعادة التشغيل بلا أثر جانبي.
-- =====================================================================

-- ---------- ١) تثبيت دالة تسجيل الفجوة ----------

create or replace function public.record_knowledge_gap(p_question text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_department uuid;
  v_normalized text;
  v_gap_id uuid;
begin
  select company_id, department_id
    into v_company, v_department
  from public.profiles
  where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    raise exception 'unauthorized: no active company profile for current user'
      using errcode = '42501';
  end if;

  v_normalized := public.normalize_question(p_question);

  if length(v_normalized) < 3 then
    return null;
  end if;

  insert into public.knowledge_gaps
    (company_id, question, normalized_question, department_id)
  values
    (v_company, left(btrim(p_question), 1000), v_normalized, v_department)
  on conflict (company_id, normalized_question) do update
    set times_asked   = public.knowledge_gaps.times_asked + 1,
        last_asked_at = now(),
        -- إعادة فتح الفجوة إذا سُئلت مجددًا بعد تجاهلها
        status = case
                   when public.knowledge_gaps.status = 'DISMISSED' then 'OPEN'
                   else public.knowledge_gaps.status
                 end
  returning id into v_gap_id;

  -- يُحفظ السائل كي يصله التنبيه حين تُحلّ فجوته. بلا هذا تبقى الدائرة
  -- مفتوحة: يُجاب السؤال ولا يعلم صاحبه، فلا يعود ليسأل.
  if v_gap_id is not null then
    insert into public.knowledge_gap_askers (gap_id, user_id, company_id)
    values (v_gap_id, auth.uid(), v_company)
    on conflict (gap_id, user_id) do update set asked_at = now();
  end if;

  return v_gap_id;
end;
$$;

revoke all on function public.record_knowledge_gap(text) from public, anon;
grant execute on function public.record_knowledge_gap(text) to authenticated;

-- ---------- ٢) استرجاع أصحاب الفجوات القائمة ----------
--
-- الشرط `g.company_id = m.company_id` ليس زينة: بدونه يمكن أن يُنسب
-- سؤالٌ في شركة إلى موظف في أخرى لو تطابق نصّ السؤال — وهو تطابق
-- متوقّع تمامًا في أسئلة مثل «كم أيام الإجازة السنوية». الخلط هنا
-- يسرّب اسم موظف من شركة إلى لوحة شركة أخرى، وهو ما لا يُغتفر.

insert into public.knowledge_gap_askers (gap_id, user_id, company_id, asked_at)
select
  g.id,
  m.user_id,
  g.company_id,
  min(m.created_at)
from public.knowledge_gaps g
join public.messages m
  on  m.company_id = g.company_id
  and m.role = 'USER'
  and m.user_id is not null
  and public.normalize_question(m.content) = g.normalized_question
group by g.id, m.user_id, g.company_id
on conflict (gap_id, user_id) do nothing;
