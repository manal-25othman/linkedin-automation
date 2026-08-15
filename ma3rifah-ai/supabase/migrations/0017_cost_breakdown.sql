-- =====================================================================
-- 0017 — تفصيل التكلفة والهامش لكل شركة
--
-- مفتاح واحد يخدم كل العملاء، فالفاتورة تصل مجمّعة. والسؤال الذي يحدّد
-- بقاء المشروع ليس «كم أنفقت» بل «كم أنفقتُ على من» — فشركة واحدة
-- تستهلك ضعف اشتراكها تأكل هامش أربع شركات رابحة، ولا يظهر ذلك في
-- المجموع أبدًا.
-- =====================================================================

create or replace function public.company_cost_breakdown(
  p_company_id uuid,
  p_months int default 6
)
returns table (
  period_month     date,
  operation        text,
  calls            bigint,
  input_tokens     bigint,
  output_tokens    bigint,
  cost_usd         numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- مالك المنصة لأي شركة، ومدير الشركة لشركته وحدها
  if not (
    public.is_super_admin()
    or (p_company_id = public.current_company_id() and public.is_company_admin())
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  return query
  select
    date_trunc('month', l.created_at)::date,
    l.operation,
    count(*),
    sum(l.input_tokens)::bigint,
    sum(l.output_tokens)::bigint,
    sum(l.estimated_cost_usd)
  from public.ai_usage_logs l
  where l.company_id = p_company_id
    and l.created_at >= date_trunc('month', now())
        - make_interval(months => greatest(coalesce(p_months, 6), 1) - 1)
  group by 1, 2
  order by 1 desc, 6 desc;
end;
$$;

revoke all on function public.company_cost_breakdown(uuid, int) from public, anon;
grant execute on function public.company_cost_breakdown(uuid, int) to authenticated;

-- =====================================================================
-- الهامش لكل شركة — لمالك المنصة
--
-- يقارن تكلفة الشهر الجاري باشتراك الشركة، فيظهر من يربح ومن يخسر.
-- تسعير Enterprise مخصّص فيعود null، ولا يُخمَّن.
-- =====================================================================

create or replace function public.platform_margin_report()
returns table (
  company_id     uuid,
  company_name   text,
  plan_name      text,
  price_amount   numeric,
  currency       text,
  cost_usd_month numeric,
  questions_month bigint,
  questions_limit int,
  cost_ratio     numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.name,
    p.name,
    p.price_amount,
    p.currency,
    coalesce(u.estimated_cost_usd, 0),
    coalesce(u.questions_count, 0)::bigint,
    p.max_questions_monthly,
    -- نسبة التكلفة إلى الاشتراك. يُحوَّل الريال إلى الدولار بسعر ثابت
    -- (الريال مربوط بالدولار)، فالنسبة تقديرية لا محاسبية.
    case
      when p.price_amount is null or p.price_amount = 0 then null
      else round(
        (coalesce(u.estimated_cost_usd, 0) / (p.price_amount / 3.75)) * 100,
        1
      )
    end
  from public.companies c
  left join public.subscriptions s on s.company_id = c.id
  left join public.plans p on p.id = s.plan_id
  left join public.usage_records u
    on u.company_id = c.id and u.period_month = date_trunc('month', now())::date
  order by coalesce(u.estimated_cost_usd, 0) desc;
end;
$$;

revoke all on function public.platform_margin_report() from public, anon;
grant execute on function public.platform_margin_report() to authenticated;
