-- =====================================================================
-- اختبارات التقرير المالي (0028)
--
-- وأخطر ما يُختبر هنا ليس صحّة الجمع — بل **من يراه**. التقرير يجمع
-- إيرادات كل الشركات وأرباحها في جدول واحد، فتسريبه إلى مدير شركة
-- يكشف له كم تدفع الشركات الأخرى ومن يخسر منها. وهو تسرّب أشدّ من
-- تسرّب مستند، لأنه يكشف الشركات كلّها دفعة واحدة.
-- =====================================================================

-- =====================================================================
-- المجموعة 1 — لا يراه إلا مالك المنصّة
-- =====================================================================

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-2000-4000-8000-000000000001"}';

do $$
declare
  v_blocked boolean := false;
begin
  begin
    perform public.platform_finance_summary(6);
  exception when others then
    v_blocked := true;
  end;

  insert into public.test_results (category, name, passed, detail)
  values ('التقرير المالي', 'مدير الشركة لا يقرأ الملخّص المالي للمنصّة',
          v_blocked, 'يكشف إيرادات كل الشركات دفعةً واحدة');
end $$;

do $$
declare
  v_blocked boolean := false;
begin
  begin
    perform public.platform_company_pnl(null);
  exception when others then
    v_blocked := true;
  end;

  insert into public.test_results (category, name, passed, detail)
  values ('التقرير المالي', 'مدير الشركة لا يقرأ أرباح الشركات',
          v_blocked, null);
end $$;

do $$
declare
  v_blocked boolean := false;
begin
  begin
    perform 1 from public.platform_expenses limit 1;
  exception when insufficient_privilege then
    v_blocked := true;
  end;

  insert into public.test_results (category, name, passed, detail)
  values ('التقرير المالي', 'مدير الشركة لا يقرأ مصاريف المنصّة',
          v_blocked, null);
end $$;

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-2000-4000-8000-000000000003"}';

do $$
declare
  v_blocked boolean := false;
begin
  begin
    perform public.platform_finance_summary(6);
  exception when others then
    v_blocked := true;
  end;

  insert into public.test_results (category, name, passed, detail)
  values ('التقرير المالي', 'الموظف لا يقرأ الملخّص المالي', v_blocked, null);
end $$;

commit;

begin;
set local role anon;

do $$
declare
  v_blocked boolean := false;
begin
  begin
    perform public.platform_finance_summary(6);
  exception when others then
    v_blocked := true;
  end;

  insert into public.test_results (category, name, passed, detail)
  values ('التقرير المالي', 'الزائر المجهول لا يقرأ الملخّص المالي', v_blocked, null);
end $$;

do $$
declare
  v_blocked boolean := false;
begin
  begin
    perform 1 from public.platform_expenses limit 1;
  exception when insufficient_privilege then
    v_blocked := true;
  end;

  insert into public.test_results (category, name, passed, detail)
  values ('التقرير المالي', 'الزائر المجهول لا يقرأ مصاريف المنصّة', v_blocked, null);
end $$;

commit;

-- =====================================================================
-- المجموعة 2 — الحساب نفسه
--
-- ضابط موجب لازم: لو رُفض الوصول للجميع لَنجحت المجموعة الأولى كلها
-- بينما التقرير معطَّل تمامًا. فلا بدّ من إثبات أنه **يعمل** لمن يحقّ له.
-- =====================================================================

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-2000-4000-8000-000000000001"}';

do $$
declare
  v_rows integer;
begin
  select count(*) into v_rows from public.platform_finance_summary(6);

  insert into public.test_results (category, name, passed, detail)
  values ('التقرير المالي', 'مالك المنصّة يقرأ الملخّص (ضابط موجب)',
          v_rows = 6, 'أشهر عائدة: ' || v_rows::text);
end $$;

do $$
declare
  v_rows integer;
begin
  select count(*) into v_rows from public.platform_finance_summary(3);

  insert into public.test_results (category, name, passed, detail)
  values ('التقرير المالي', 'مدى الأشهر معامل يُحترم', v_rows = 3,
          'أشهر عائدة: ' || v_rows::text);
end $$;

do $$
declare
  v_rows integer;
begin
  -- قيمة خارج المدى تُقصّ ولا تُسقط الاستعلام
  select count(*) into v_rows from public.platform_finance_summary(9999);

  insert into public.test_results (category, name, passed, detail)
  values ('التقرير المالي', 'مدى هائل يُقصّ إلى 24 شهرًا', v_rows = 24,
          'أشهر عائدة: ' || v_rows::text);
end $$;

do $$
declare
  v_companies integer;
begin
  select count(*) into v_companies from public.platform_company_pnl(null);

  insert into public.test_results (category, name, passed, detail)
  values ('التقرير المالي', 'تفصيل الشركات يشمل كل شركة',
          v_companies >= 2, 'شركات: ' || v_companies::text);
end $$;

-- الإيراد **مقبوض** لا مستحَقّ: شركة باشتراك بلا دفعة إيرادها صفر
do $$
declare
  v_revenue numeric;
begin
  select revenue_sar into v_revenue
  from public.platform_company_pnl(null)
  where company_id = 'aaaaaaaa-0000-4000-8000-000000000001';

  insert into public.test_results (category, name, passed, detail)
  values ('التقرير المالي',
          'الإيراد مقبوض لا مستحَقّ — اشتراك بلا دفعة = صفر',
          coalesce(v_revenue, 0) = 0,
          'إيراد: ' || coalesce(v_revenue, 0)::text
            || ' — ولو قِيس على سعر الخطة لظهر إيرادًا كاملًا');
end $$;

commit;

-- الدفعة المسجَّلة تظهر في الإيراد — ضابط موجب على الجهة الأخرى
begin;

insert into public.payments
  (id, company_id, plan_id, provider, amount_halalas, currency, status, paid_at)
select
  'ffffffff-9000-4000-8000-000000000001',
  'aaaaaaaa-0000-4000-8000-000000000001',
  s.plan_id,
  'test',
  249900,
  'SAR',
  'PAID',
  now()
from public.subscriptions s
where s.company_id = 'aaaaaaaa-0000-4000-8000-000000000001'
limit 1;

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-2000-4000-8000-000000000001"}';

do $$
declare
  v_revenue numeric;
begin
  select revenue_sar into v_revenue
  from public.platform_company_pnl(null)
  where company_id = 'aaaaaaaa-0000-4000-8000-000000000001';

  insert into public.test_results (category, name, passed, detail)
  values ('التقرير المالي', 'الدفعة المسجَّلة تظهر إيرادًا (ضابط موجب)',
          v_revenue = 2499, 'إيراد: ' || coalesce(v_revenue, 0)::text);
end $$;

commit;

-- الدفعتان اللتان لا تُحتسبان — وهما ما يُجمّل التقرير لو أُهملتا.
--
-- والفرق بينهما هو ما كشفه الضابط السالب: **الفاشلة لا تكفي اختبارًا**،
-- لأن `paid_at` فيها فارغ فيصفّيها الشرطُ الآخر وحده. فحُذف شرط الحالة
-- ولم يسقط اختبار — أي أن الاختبار كان يحرس ما لا يحتاج حراسة.
--
-- والحالة الخطرة فعلًا هي **المستردَّة**: تاريخ سدادها مضبوط لأنها
-- سُدِّدت فعلًا ثم رُدّت. فإن سقط شرط الحالة حُسب المردود إيرادًا،
-- وهو تضخيمٌ لا يظهر إلا في المصرف.
--
-- والإدراج خارج كتلة الدور عمدًا: `payments` لا تقبل كتابةً من
-- `authenticated`، وهو المطلوب — المدفوعات تُكتب بمفتاح الخدمة بعد
-- تأكيد المزوّد لا من متصفّح.
begin;
insert into public.payments
  (id, company_id, plan_id, provider, amount_halalas, currency, status, paid_at)
select
  'ffffffff-9000-4000-8000-000000000002',
  'aaaaaaaa-0000-4000-8000-000000000001',
  s.plan_id, 'test', 599900, 'SAR', 'FAILED', null
from public.subscriptions s
where s.company_id = 'aaaaaaaa-0000-4000-8000-000000000001'
limit 1;

insert into public.payments
  (id, company_id, plan_id, provider, amount_halalas, currency, status, paid_at)
select
  'ffffffff-9000-4000-8000-000000000003',
  'aaaaaaaa-0000-4000-8000-000000000001',
  s.plan_id, 'test', 100000, 'SAR', 'REFUNDED', now()
from public.subscriptions s
where s.company_id = 'aaaaaaaa-0000-4000-8000-000000000001'
limit 1;
commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-2000-4000-8000-000000000001"}';

do $$
declare
  v_revenue numeric;
begin
  select revenue_sar into v_revenue
  from public.platform_company_pnl(null)
  where company_id = 'aaaaaaaa-0000-4000-8000-000000000001';

  -- الناجحة 2499 وحدها؛ ولو حُسبت الفاشلة والمستردَّة لصار 9498
  insert into public.test_results (category, name, passed, detail)
  values ('التقرير المالي', 'الفاشلة والمستردَّة لا تُحتسبان إيرادًا',
          v_revenue = 2499,
          'إيراد: ' || coalesce(v_revenue, 0)::text || ' (ولو حُسبتا لصار 9498)');
end $$;

commit;

-- =====================================================================
-- المجموعة 3 — المصاريف الثابتة تُطرح فعلًا
--
-- ولو أُهملت لَبدا الربح أكبر مما هو — وهو الخطأ الذي تُبنى عليه قرارات
-- توظيف وإنفاق.
-- =====================================================================

begin;
insert into public.platform_expenses (label, amount_usd, starts_on)
values ('اختبار — استضافة', 100.00, date_trunc('month', now())::date);
commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-2000-4000-8000-000000000001"}';

do $$
declare
  v_fixed numeric;
begin
  select fixed_cost_usd into v_fixed
  from public.platform_finance_summary(1);

  insert into public.test_results (category, name, passed, detail)
  values ('التقرير المالي', 'المصروف الثابت يدخل الحساب',
          v_fixed >= 100, 'ثابت: ' || coalesce(v_fixed, 0)::text);
end $$;

do $$
declare
  v_revenue numeric;
  v_ai      numeric;
  v_fixed   numeric;
  v_net     numeric;
begin
  select revenue_sar, ai_cost_usd, fixed_cost_usd, net_profit_sar
    into v_revenue, v_ai, v_fixed, v_net
  from public.platform_finance_summary(1);

  insert into public.test_results (category, name, passed, detail)
  values ('التقرير المالي', 'الربح الصافي = الإيراد − (الذكاء + الثابت) × 3.75',
          abs(v_net - (v_revenue - (v_ai + v_fixed) * 3.75)) < 0.01,
          'صافي: ' || v_net::text);
end $$;

commit;

-- المصروف المنتهي قبل الشهر لا يُحتسب
begin;
insert into public.platform_expenses (label, amount_usd, starts_on, ends_on)
values (
  'اختبار — أداة أُلغيت',
  500.00,
  (date_trunc('month', now()) - interval '6 months')::date,
  (date_trunc('month', now()) - interval '3 months')::date
);
commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-2000-4000-8000-000000000001"}';

do $$
declare
  v_fixed numeric;
begin
  select fixed_cost_usd into v_fixed
  from public.platform_finance_summary(1);

  insert into public.test_results (category, name, passed, detail)
  values ('التقرير المالي', 'المصروف المنتهي لا يُحتسب في شهر لاحق',
          v_fixed < 500, 'ثابت: ' || coalesce(v_fixed, 0)::text);
end $$;

commit;
