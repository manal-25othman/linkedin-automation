-- =====================================================================
-- 0013 — التحقق من رسوخ الإجابة في مصادرها
--
-- تُحسب هذه القيم على الخادم بعد التوليد وقبل الحفظ. تخزينها يجعل جودة
-- الإجابات قابلة للقياس عبر الزمن بدل أن تكون انطباعًا: هبوط متوسط
-- الرسوخ في شركة ما إنذار مبكر بأن مستنداتها لم تعد تغطي أسئلتها،
-- وهو ما يسبق مغادرة العميل بأسابيع.
-- =====================================================================

alter table public.messages
  add column if not exists confidence      real,
  add column if not exists groundedness    real,
  -- عدد الأرقام التي وردت في الإجابة بلا أصل في المصادر
  add column if not exists unverified_numbers int not null default 0,
  -- true حين استُنتجت المصادر معجميًا لغياب استشهاد صريح من النموذج
  add column if not exists citations_inferred boolean not null default false;

comment on column public.messages.confidence is
  'درجة ثقة مركّبة ∈ [0,1]: 0.25×التشابه + 0.45×الرسوخ + 0.30×نسبة الأرقام المؤكدة';
comment on column public.messages.groundedness is
  'نسبة رموز الإجابة الموجودة في المصادر ∈ [0,1]';

-- إجابات منخفضة الثقة — أكثر ما يستحق مراجعة مدير الشركة
create index if not exists messages_low_confidence_idx
  on public.messages (company_id, created_at desc)
  where role = 'ASSISTANT' and confidence < 0.5;

-- =====================================================================
-- تحديث تقرير جودة الإجابات
-- =====================================================================

drop function if exists public.company_answer_quality(int);

create or replace function public.company_answer_quality(p_days int default 30)
returns table (
  answers_total        bigint,
  answers_with_source  bigint,
  avg_latency_ms       int,
  feedback_up          bigint,
  feedback_down        bigint,
  feedback_total       bigint,
  avg_confidence       real,
  avg_groundedness     real,
  low_confidence_count bigint,
  unverified_number_answers bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_since   timestamptz;
begin
  select company_id into v_company
  from public.profiles where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  v_since := now() - make_interval(days => greatest(coalesce(p_days, 30), 1));

  return query
  select
    count(*) filter (where m.role = 'ASSISTANT'),
    count(*) filter (
      where m.role = 'ASSISTANT'
        and exists (select 1 from public.message_sources s where s.message_id = m.id)
    ),
    coalesce(avg(m.latency_ms) filter (where m.role = 'ASSISTANT'), 0)::int,
    count(*) filter (where m.feedback = 'UP'),
    count(*) filter (where m.feedback = 'DOWN'),
    count(*) filter (where m.feedback is not null),
    coalesce(avg(m.confidence) filter (where m.role = 'ASSISTANT'), 0)::real,
    coalesce(avg(m.groundedness) filter (where m.role = 'ASSISTANT'), 0)::real,
    count(*) filter (where m.role = 'ASSISTANT' and m.confidence < 0.5),
    count(*) filter (where m.role = 'ASSISTANT' and m.unverified_numbers > 0)
  from public.messages m
  where m.company_id = v_company
    and m.created_at >= v_since;
end;
$$;

revoke all on function public.company_answer_quality(int) from public, anon;
grant execute on function public.company_answer_quality(int) to authenticated;
