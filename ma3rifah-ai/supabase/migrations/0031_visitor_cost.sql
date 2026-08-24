-- =====================================================================
-- 0031 — تكلفة مساعد الزوّار تدخل التقرير المالي
--
-- في `site-chat.ts` تعليقٌ بخطّي يقول إن تكلفة مساعد الزوّار «تُسجَّل في
-- site_chat_messages وحدها **ويُجمّعها تقرير المنصة**».
--
-- **ولم يكن التقرير يجمّعها.** يقرأ `usage_records` وحدها، وهي لا تحوي
-- محادثات الزوّار لأن تكلفتها لا تُحمَّل على شركة. فكانت كل محادثة زائر
-- تُنادي النموذج، وتُفوتَر على المالكة من Anthropic، **ولا تظهر في أي
-- رقم**.
--
-- والأثر مضاعَف: التكلفة تُخفى، والربح يظهر أعلى مما هو. وهو نفس اتجاه
-- الخطأ الذي عولج في تسعير رموز التخزين المؤقت — الرقم المتفائل لا يدفع
-- أحدًا إلى مراجعته.
--
-- ---------------------------------------------------------------------
-- لماذا تُخزَّن التكلفة ولا تُحسب في SQL
--
-- الجدول يحفظ الرموز والنموذج، فكان يمكن تسعيرها هنا. لكن ذلك يكرّر
-- جدول الأسعار في مكانين، فيتعفّن أحدهما عند أول تغيير سعر — ولا يظهر
-- التعفّن إلا في تقرير الأرباح.
--
-- فتُحسب مرة واحدة في `estimateCostUsd` — حيث تُحسب كل تكلفة أخرى بما
-- فيها التخزين المؤقت — وتُخزَّن.
--
-- ---------------------------------------------------------------------
-- ولماذا تُعرض منفصلة عن تكلفة الشركات
--
-- تكلفة مساعد الزوّار **مصروف اكتساب عملاء** لا تكلفة خدمة: تُنفَق على
-- من لم يشترك بعد. وجمعُها مع تكلفة الشركات يشوّه هامش الخدمة ويُخفي
-- سؤالًا تجاريًّا حقيقيًّا: كم يكلّفني الزائر الواحد، وكم منهم يتحوّل؟
-- =====================================================================

alter table public.site_chat_messages
  add column if not exists estimated_cost_usd numeric(12,6) not null default 0;

create index if not exists site_chat_messages_cost_idx
  on public.site_chat_messages (created_at)
  where estimated_cost_usd > 0;

-- =====================================================================
-- الملخّص الشهري — يشمل الآن تكلفة الزوّار
-- =====================================================================

drop function if exists public.platform_finance_summary(integer);

create or replace function public.platform_finance_summary(p_months integer default 6)
returns table (
  period_month     date,
  revenue_sar      numeric,
  ai_cost_usd      numeric,
  visitor_cost_usd numeric,
  fixed_cost_usd   numeric,
  net_profit_sar   numeric,
  margin_percent   numeric,
  paying_companies bigint,
  questions_count  bigint,
  visitor_messages bigint
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
  -- مساعد الزوّار: تكلفة تقع على المنصّة مباشرةً ولا تُحمَّل على شركة
  visitors as (
    select
      date_trunc('month', v.created_at)::date as m,
      sum(v.estimated_cost_usd)               as usd,
      count(*)                                as messages
    from public.site_chat_messages v
    where v.role = 'ASSISTANT'
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
  ),
  totals as (
    select
      months.m,
      coalesce(revenue.sar, 0)      as revenue_sar,
      coalesce(ai.usd, 0)           as ai_usd,
      coalesce(visitors.usd, 0)     as visitor_usd,
      fixed.usd                     as fixed_usd,
      coalesce(revenue.companies, 0) as companies,
      coalesce(ai.questions, 0)     as questions,
      coalesce(visitors.messages, 0) as messages
    from months
    left join revenue  on revenue.m = months.m
    left join ai       on ai.m = months.m
    left join visitors on visitors.m = months.m
    join fixed         on fixed.m = months.m
  )
  select
    t.m,
    t.revenue_sar,
    t.ai_usd,
    t.visitor_usd,
    t.fixed_usd,
    -- كل شيء بالريال عند العرض. والريال مربوط بالدولار عند 3.75،
    -- فالتحويل ثابت لا تقديري.
    t.revenue_sar - (t.ai_usd + t.visitor_usd + t.fixed_usd) * 3.75,
    case
      when t.revenue_sar = 0 then null
      else round(
        ((t.revenue_sar - (t.ai_usd + t.visitor_usd + t.fixed_usd) * 3.75)
          / t.revenue_sar) * 100,
        1
      )
    end,
    t.companies::bigint,
    t.questions::bigint,
    t.messages::bigint
  from totals t
  order by t.m;
end;
$$;

revoke all on function public.platform_finance_summary(integer) from public, anon;
grant execute on function public.platform_finance_summary(integer) to authenticated;
