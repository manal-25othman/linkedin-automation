-- =====================================================================
-- 0026 — تنبيه اقتراب الحصة
--
-- النوع `QUOTA_WARNING` معرَّف في 0014 منذ البداية، ولم يُرسَل قطّ.
-- أي أن المنصة تحمل ميزةً موجودةً شكلًا لا تعمل — وهو أسوأ من غيابها:
-- من يقرأ قائمة الأنواع يظنّ التنبيه يصل، فلا يبحث عن سببٍ لعدم وصوله.
--
-- والأثر التجاري لا الأمني هو المقصود هنا: العميل الذي يُفاجأ بتوقّف
-- الأسئلة يغضب ويفتح تذكرة دعم. والعميل الذي يُنبَّه عند 80٪ يرقّي
-- خطته — وهي كل فائدة وجود الحصة أصلًا.
--
-- **يُرسَل مرة واحدة لكل شهر ولكل مدير.** والتكرار هنا احتمالٌ حقيقي:
-- الدالة تُستدعى بعد **كل سؤال**، فبعد بلوغ 80٪ يبقى الشرط صادقًا في
-- كل سؤال تالٍ. ومعرّف الكيان يُشتقّ من (الشركة + الشهر) اشتقاقًا
-- ثابتًا، فيصير الفهرس الفريد (user_id, type, entity_id) هو الذي يمنع
-- التكرار — لا شرطٌ في الشيفرة يُنسى.
-- =====================================================================

create or replace function public.notify_quota_warning()
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_quota   int;
  v_used    int;
  v_entity  uuid;
  v_percent int;
begin
  select company_id into v_company
  from public.profiles
  where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    return;
  end if;

  -- الحصة والاستهلاك — نفس مصدر check_question_quota
  select coalesce(
           nullif(s.limit_overrides ->> 'max_questions_monthly', '')::int,
           p.max_questions_monthly
         )
    into v_quota
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.company_id = v_company;

  -- خطة بلا حدّ للأسئلة: لا شيء يُنبَّه عنه
  if v_quota is null or v_quota <= 0 then
    return;
  end if;

  select coalesce(u.questions_count, 0) into v_used
  from public.usage_records u
  where u.company_id = v_company
    and u.period_month = date_trunc('month', now())::date;

  v_used := coalesce(v_used, 0);
  v_percent := (v_used * 100) / v_quota;

  -- دون 80٪ لا تنبيه. وفوق الحصة تتوقف الأسئلة برسالتها الخاصة،
  -- فتنبيهُ «اقتربتِ» بعد النفاد يصل متأخرًا ويقرأ استهزاءً.
  if v_percent < 80 or v_used >= v_quota then
    return;
  end if;

  -- معرّف ثابت لكل (شركة + شهر) — هو ما يمنع التكرار عبر الفهرس الفريد
  v_entity := md5(v_company::text || ':quota:' || to_char(now(), 'YYYY-MM'))::uuid;

  insert into public.notifications
    (company_id, user_id, type, title, body, link, entity_type, entity_id)
  select
    v_company,
    pr.id,
    'QUOTA_WARNING',
    'اقترب حدّ الأسئلة الشهري',
    'استُهلك ' || v_percent || '٪ من حصة هذا الشهر (' || v_used || ' من ' || v_quota ||
      ' سؤال). عند بلوغ الحدّ تتوقف الأسئلة الجديدة حتى بداية الشهر القادم أو ترقية الخطة.',
    '/settings/billing',
    'subscription',
    v_entity
  from public.profiles pr
  where pr.company_id = v_company
    and pr.role = 'COMPANY_ADMIN'
    and pr.status = 'ACTIVE'
  on conflict (user_id, type, entity_id) do nothing;
end;
$$;

comment on function public.notify_quota_warning() is
  'ينبّه مديري الشركة عند بلوغ 80٪ من حصة الأسئلة — مرة واحدة لكل شهر.';

grant execute on function public.notify_quota_warning() to authenticated;
