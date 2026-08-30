-- =====================================================================
-- 0028 — التقرير المالي لمالك المنصّة
--
-- الموجود قبل هذه الترحيلة تقريرُ **نسبة تكلفة** لكل شركة: كم تلتهم
-- تكلفةُ الذكاء من سعر خطتها. وهو مفيد ولا يكفي، لأنه يفتقد ثلاثة
-- أشياء لا تقوم بها إدارةُ ربح:
--
--   ١) **الإيراد المقبوض** — التقرير القديم يقيس على **سعر الخطة**، وهو
--      ما ينبغي أن يُدفع لا ما دُفع. وشركةٌ في تجربة، أو متأخّرة عن
--      السداد، أو ألغت — كلّها تظهر هناك بإيراد كامل. والفرق بين
--      «مستحَقّ» و«مقبوض» هو الفرق بين ورقةٍ جميلة وحسابٍ بنكيّ.
--
--   ٢) **التكاليف الثابتة** — الاستضافة والقاعدة والأدوات. لا تُسجَّل
--      في أي مكان، فلا يُطرح منها شيء، فيبدو الربح أكبر مما هو.
--
--   ٣) **الاتجاه** — رقمُ شهرٍ واحد لا يقول أنموٍّ هو أم انكماش.
--
-- فتضيف هذه الترحيلة الثلاثة: جدولًا للمصاريف الثابتة، ودالّةً تجمع
-- الإيراد المقبوض والتكلفة الفعلية شهرًا بشهر، ودالّةً تفصّل الربح لكل
-- شركة — فيُعرف **العميل الخاسر بالاسم**، وهو أهمّ ما في التقرير كلّه.
-- =====================================================================

-- =====================================================================
-- ١) المصاريف الثابتة — تُدخَل يدويًا لأنها ليست في أي جدول
-- =====================================================================

create table if not exists public.platform_expenses (
  id          uuid primary key default gen_random_uuid(),
  label       text        not null check (length(trim(label)) between 2 and 80),
  -- بالدولار: أكثر فواتير البنية التحتية بالدولار، وتحويلها عند العرض
  amount_usd  numeric(10,2) not null check (amount_usd >= 0),
  -- الشهر الذي يبدأ منه سريان المصروف
  starts_on   date        not null,
  -- null = ما زال ساريًا
  ends_on     date,
  note        text,
  created_at  timestamptz not null default now(),

  constraint expense_period_valid check (ends_on is null or ends_on >= starts_on)
);

create index if not exists platform_expenses_period_idx
  on public.platform_expenses (starts_on, ends_on);

-- لا وصول لأحد إلا مالك المنصّة، ومن خلال الدوالّ وحدها
alter table public.platform_expenses enable row level security;
revoke all on public.platform_expenses from anon, authenticated;

-- =====================================================================
-- ٢) الملخّص الشهري — إيراد مقبوض وتكلفة فعلية وربح صافٍ
--
-- والمدى بالأشهر معامل، فيُرسم الاتجاه لا لقطة شهر.
-- =====================================================================

-- يُسقَط قبل الإنشاء.
--
-- `create or replace` لا يغيّر نوع الإرجاع. والحزمة تُشغَّل على قواعد
-- قائمة لا نظيفة فقط، فإن كانت ترحيلةٌ لاحقة قد وسّعت هذه الدالّة
-- (0031 أضافت تكلفة الزوّار) ثم أُعيد تشغيل الحزمة، وصل هذا السطر
-- ليعيدها إلى توقيعها الضيّق فسقط الاستعلام كلّه.
--
-- والعطل يقع في الترحيلة **الأقدم** لا الأحدث، وهو ما يُربك تشخيصه.
drop function if exists public.platform_finance_summary(integer);

create or replace function public.platform_finance_summary(p_months integer default 6)
returns table (
  period_month    date,
  revenue_sar     numeric,
  ai_cost_usd     numeric,
  fixed_cost_usd  numeric,
  net_profit_sar  numeric,
  margin_percent  numeric,
  paying_companies bigint,
  questions_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_months integer := least(greatest(coalesce(p_months, 6), 1), 24);
begin
  if not public.is_super_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  return query
  with months as (
    select generate_series(
      date_trunc('month', now() - make_interval(months => v_months - 1))::date,
      date_trunc('month', now())::date,
      interval '1 month'
    )::date as m
  ),
  -- الإيراد **المقبوض** لا المستحَقّ: مدفوعات نجحت فعلًا
  revenue as (
    select
      date_trunc('month', p.paid_at)::date as m,
      sum(p.amount_halalas) / 100.0        as sar,
      count(distinct p.company_id)         as companies
    from public.payments p
    where p.status = 'PAID' and p.paid_at is not null
    group by 1
  ),
  ai as (
    select
      u.period_month as m,
      sum(u.estimated_cost_usd) as usd,
      sum(u.questions_count)    as questions
    from public.usage_records u
    group by 1
  ),
  fixed as (
    select
      months.m,
      coalesce(sum(e.amount_usd), 0) as usd
    from months
    left join public.platform_expenses e
      on e.starts_on <= (months.m + interval '1 month' - interval '1 day')::date
     and (e.ends_on is null or e.ends_on >= months.m)
    group by months.m
  )
  select
    months.m,
    coalesce(revenue.sar, 0),
    coalesce(ai.usd, 0),
    fixed.usd,
    -- كل شيء بالريال عند العرض. والريال مربوط بالدولار عند 3.75،
    -- فالتحويل ثابت لا تقديري.
    coalesce(revenue.sar, 0) - (coalesce(ai.usd, 0) + fixed.usd) * 3.75,
    case
      when coalesce(revenue.sar, 0) = 0 then null
      else round(
        ((coalesce(revenue.sar, 0) - (coalesce(ai.usd, 0) + fixed.usd) * 3.75)
          / revenue.sar) * 100,
        1
      )
    end,
    coalesce(revenue.companies, 0)::bigint,
    coalesce(ai.questions, 0)::bigint
  from months
  left join revenue on revenue.m = months.m
  left join ai      on ai.m = months.m
  join fixed        on fixed.m = months.m
  order by months.m;
end;
$$;

revoke all on function public.platform_finance_summary(integer) from public, anon;
grant execute on function public.platform_finance_summary(integer) to authenticated;

-- =====================================================================
-- ٣) الربح لكل شركة — من يربح ومن يخسر، بالاسم
--
-- وهذا أهمّ ما في الترحيلة. المتوسّط يخفي: عشرة عملاء رابحين وواحدٌ
-- خاسرٌ بشدّة قد يُظهر متوسّطًا صحّيًا بينما العميل الأكثر استعمالًا
-- يلتهم ربح البقيّة. ولا يُرى ذلك إلا مفصَّلًا.
-- =====================================================================

create or replace function public.platform_company_pnl(p_month date default null)
returns table (
  company_id      uuid,
  company_name    text,
  plan_name       text,
  is_demo         boolean,
  revenue_sar     numeric,
  ai_cost_usd     numeric,
  profit_sar      numeric,
  margin_percent  numeric,
  questions_count integer,
  questions_limit integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_month date := coalesce(p_month, date_trunc('month', now())::date);
begin
  if not public.is_super_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.name,
    p.name,
    c.is_demo,
    coalesce(r.sar, 0),
    coalesce(u.estimated_cost_usd, 0),
    coalesce(r.sar, 0) - coalesce(u.estimated_cost_usd, 0) * 3.75,
    case
      when coalesce(r.sar, 0) = 0 then null
      else round(
        ((coalesce(r.sar, 0) - coalesce(u.estimated_cost_usd, 0) * 3.75) / r.sar) * 100,
        1
      )
    end,
    coalesce(u.questions_count, 0),
    p.max_questions_monthly
  from public.companies c
  left join public.subscriptions s on s.company_id = c.id
  left join public.plans p         on p.id = s.plan_id
  left join public.usage_records u
    on u.company_id = c.id and u.period_month = v_month
  left join lateral (
    select sum(pay.amount_halalas) / 100.0 as sar
    from public.payments pay
    where pay.company_id = c.id
      and pay.status = 'PAID'
      and pay.paid_at is not null
      and date_trunc('month', pay.paid_at)::date = v_month
  ) r on true
  -- الأخسر أولًا: هو الذي يحتاج قرارًا، والرابح لا يحتاج شيئًا
  order by (coalesce(r.sar, 0) - coalesce(u.estimated_cost_usd, 0) * 3.75) asc;
end;
$$;

revoke all on function public.platform_company_pnl(date) from public, anon;
grant execute on function public.platform_company_pnl(date) to authenticated;
