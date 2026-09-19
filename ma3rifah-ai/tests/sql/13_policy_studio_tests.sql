-- =====================================================================
-- المجموعة ١٤ — استوديو السياسات (0040)
-- =====================================================================
-- الادّعاء الذي تُثبته هذه المجموعة ثلاثة أشقاق:
--
-- ١) المسوّدة **لا يراها موظف**. نصٌّ تنظيميّ لم يُقرّه أحد، ورؤيته
--    لموظف تعني أنه قد يعمل به — وهذا بالضبط ما يمنعه الاستوديو.
-- ٢) المسوّدة لا تعبر حدّ الشركة، لا قراءةً ولا كتابةً ولا عبر الدالّة.
-- ٣) **الاعتماد حدثٌ له صاحب وتاريخ** — قيد القاعدة يرفض «معتمَدة»
--    بلا معتمِد، فلا يمكن ترقية مسوّدة بتحديث عمود واحد.

\set company_a      '''aaaaaaaa-0000-4000-8000-000000000001'''
\set company_b      '''bbbbbbbb-0000-4000-8000-000000000001'''
\set user_a_admin   '''aaaaaaaa-2000-4000-8000-000000000001'''
\set user_a_hr_emp  '''aaaaaaaa-2000-4000-8000-000000000003'''
\set user_b_admin   '''bbbbbbbb-2000-4000-8000-000000000001'''

-- مسوّدة لكل شركة، بمفتاح الخدمة
insert into public.policy_drafts
  (id, company_id, title, topic, body, created_by)
values
  ('eeeeeeee-0000-4000-8000-00000000000a', :company_a::uuid,
   'سياسة بدل السكن', 'بدل السكن',
   'مسوّدة الشركة أ — نصّ اختباري بطول كافٍ لتجاوز الحدّ الأدنى للحفظ.',
   :user_a_admin::uuid),
  ('eeeeeeee-0000-4000-8000-00000000000b', :company_b::uuid,
   'سياسة الانتداب', 'الانتداب',
   'مسوّدة الشركة ب — نصّ اختباري بطول كافٍ لتجاوز الحدّ الأدنى للحفظ.',
   :user_b_admin::uuid)
on conflict (id) do nothing;

-- ══════════════════ موظف عادي — لا يرى شيئًا ══════════════════
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_a_hr_emp, true);

insert into public.test_results (category, name, passed, detail)
select 'استوديو السياسات', 'الموظف لا يرى مسوّدات شركته (ضابط سالب)',
       count(*) = 0, 'رأى=' || count(*)
from public.policy_drafts;

insert into public.test_results (category, name, passed, detail)
select 'استوديو السياسات', 'الموظف لا يرى نسخ المسوّدات',
       count(*) = 0, 'رأى=' || count(*)
from public.policy_draft_versions;

do $$
declare v_blocked boolean := false;
begin
  begin
    perform public.save_policy_draft_version(
      'eeeeeeee-0000-4000-8000-00000000000a',
      'محاولة موظف تعديل سياسة شركته — نصّ طويل بما يكفي لتجاوز الحدّ.');
  exception when others then v_blocked := true;
  end;
  insert into public.test_results (category, name, passed, detail)
  values ('استوديو السياسات', 'الدالّة ترفض الموظف (ضابط سالب)',
          v_blocked, case when v_blocked then 'مُنع' else 'كَتَب — خرق' end);
end $$;

commit;

-- ══════════════════ مدير الشركة أ ══════════════════
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_a_admin, true);

insert into public.test_results (category, name, passed, detail)
select 'استوديو السياسات', 'مدير الشركة يرى مسوّدته (ضابط موجب)',
       count(*) = 1, 'رأى=' || count(*)
from public.policy_drafts where company_id = :company_a::uuid;

insert into public.test_results (category, name, passed, detail)
select 'استوديو السياسات', 'مدير الشركة أ لا يرى مسوّدة الشركة ب',
       count(*) = 0, 'رأى=' || count(*)
from public.policy_drafts where company_id = :company_b::uuid;

-- الحفظ يزيد النسخة ويؤرّخها في معاملة واحدة
do $$
declare v_version int;
begin
  v_version := public.save_policy_draft_version(
    'eeeeeeee-0000-4000-8000-00000000000a',
    'النصّ بعد تحرير المدير — طويل بما يكفي لتجاوز الحدّ الأدنى للحفظ.',
    'تعديل أول');
  insert into public.test_results (category, name, passed, detail)
  values ('استوديو السياسات', 'حفظ المدير يرفع رقم النسخة (ضابط موجب)',
          v_version = 2, 'version=' || v_version);
end $$;

insert into public.test_results (category, name, passed, detail)
select 'استوديو السياسات', 'الحفظ أرشف نسخة مؤرّخة',
       count(*) = 1, 'نسخ=' || count(*)
from public.policy_draft_versions
where draft_id = 'eeeeeeee-0000-4000-8000-00000000000a' and version = 2;

-- الدالّة ترفض النصّ القصير: سياسة من سطر ليست سياسة
do $$
declare v_blocked boolean := false;
begin
  begin
    perform public.save_policy_draft_version(
      'eeeeeeee-0000-4000-8000-00000000000a', 'قصير');
  exception when others then v_blocked := true;
  end;
  insert into public.test_results (category, name, passed, detail)
  values ('استوديو السياسات', 'الدالّة ترفض مسوّدة قصيرة',
          v_blocked, case when v_blocked then 'مُنع' else 'قَبِل — خرق' end);
end $$;

-- الاعتماد بلا معتمِد: قيد القاعدة يرفضه بنيويًا
do $$
declare v_blocked boolean := false;
begin
  begin
    update public.policy_drafts set status = 'APPROVED'
    where id = 'eeeeeeee-0000-4000-8000-00000000000a';
  exception when others then v_blocked := true;
  end;
  insert into public.test_results (category, name, passed, detail)
  values ('استوديو السياسات', 'لا اعتماد بلا معتمِد وتاريخ (حاجز بنيوي)',
          v_blocked, case when v_blocked then 'مُنع' else 'اعتُمدت — خرق' end);
end $$;

-- والاعتماد الكامل يمرّ
do $$
declare v_updated int;
begin
  update public.policy_drafts
  set status = 'APPROVED', approved_by = auth.uid(), approved_at = now()
  where id = 'eeeeeeee-0000-4000-8000-00000000000a';
  get diagnostics v_updated = row_count;
  insert into public.test_results (category, name, passed, detail)
  values ('استوديو السياسات', 'الاعتماد الكامل ينفذ (ضابط موجب)',
          v_updated = 1, 'اعتُمد=' || v_updated);
end $$;

-- والمعتمدة لا تُحرَّر بعدها
do $$
declare v_blocked boolean := false;
begin
  begin
    perform public.save_policy_draft_version(
      'eeeeeeee-0000-4000-8000-00000000000a',
      'محاولة تحرير بعد الاعتماد — نصّ طويل بما يكفي لتجاوز الحدّ.');
  exception when others then v_blocked := true;
  end;
  insert into public.test_results (category, name, passed, detail)
  values ('استوديو السياسات', 'المسوّدة المعتمدة لا تُحرَّر',
          v_blocked, case when v_blocked then 'مُنع' else 'حُرِّرت — خرق' end);
end $$;

commit;

-- ══════════════════ مدير الشركة ب — الحدّ بين الشركتين ══════════════════
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_b_admin, true);

insert into public.test_results (category, name, passed, detail)
select 'استوديو السياسات', 'مدير الشركة ب لا يرى مسوّدة الشركة أ',
       count(*) = 0, 'رأى=' || count(*)
from public.policy_drafts where company_id = :company_a::uuid;

do $$
declare v_blocked boolean := false;
begin
  begin
    perform public.save_policy_draft_version(
      'eeeeeeee-0000-4000-8000-00000000000a',
      'محاولة مدير شركة أخرى — نصّ طويل بما يكفي لتجاوز الحدّ الأدنى.');
  exception when others then v_blocked := true;
  end;
  insert into public.test_results (category, name, passed, detail)
  values ('استوديو السياسات', 'الدالّة ترفض مديرًا من شركة أخرى (ضابط سالب)',
          v_blocked, case when v_blocked then 'مُنع' else 'كَتَب — خرق' end);
end $$;

insert into public.test_results (category, name, passed, detail)
select 'استوديو السياسات', 'نسخ الشركة أ محجوبة عن الشركة ب',
       count(*) = 0, 'رأى=' || count(*)
from public.policy_draft_versions where company_id = :company_a::uuid;

commit;
