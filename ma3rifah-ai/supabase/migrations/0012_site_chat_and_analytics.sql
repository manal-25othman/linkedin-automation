-- =====================================================================
-- 0012 — محادثة زوّار الموقع + توسعة التحليلات
--
-- قسمان منفصلان تمامًا:
--
--  (أ) محادثة الزوّار: على مستوى المنصة لا الشركة. جداولها بلا
--      company_id إطلاقًا، فلا سبيل بنيويًا لأن تختلط ببيانات أي
--      شركة. لا يقرأها إلا SUPER_ADMIN، ولا يكتب فيها إلا الخادم
--      عبر مفتاح الخدمة.
--
--  (ب) دوال تحليلات إضافية للشركة: جودة الإجابات، المستخدمون
--      النشطون، ساعات الذروة، التكلفة. كلها تشتق الشركة من
--      auth.uid() ولا تقبل معرّف شركة من العميل — كبقية دوال 0010.
-- =====================================================================

-- =====================================================================
-- (أ) محادثة زوّار الموقع
-- =====================================================================

do $$ begin
  create type public.site_chat_status as enum ('ANSWERED', 'UNANSWERED', 'REFUSED', 'ERROR');
exception when duplicate_object then null; end $$;

-- ---------- الزائر ----------
-- لا يُخزَّن أي معرّف شخصي: visitor_key قيمة عشوائية يولّدها الخادم
-- وتُحفظ في كوكي، ولا تُربط بأي هوية. لا عناوين IP ولا بريد.

create table if not exists public.site_visitors (
  id            uuid primary key default gen_random_uuid(),
  visitor_key   text not null unique,
  message_count int not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  /** مسار الصفحة التي بدأت منها المحادثة — للتحليل لا للتتبّع */
  entry_path    text,
  converted     boolean not null default false
);

create index if not exists site_visitors_last_seen_idx
  on public.site_visitors (last_seen_at desc);

-- ---------- رسائل الزوّار ----------

create table if not exists public.site_chat_messages (
  id            uuid primary key default gen_random_uuid(),
  visitor_id    uuid not null references public.site_visitors(id) on delete cascade,
  role          public.message_role not null,
  content       text not null,
  status        public.site_chat_status,
  latency_ms    int,
  model         text,
  input_tokens  int,
  output_tokens int,
  created_at    timestamptz not null default now()
);

create index if not exists site_chat_messages_visitor_idx
  on public.site_chat_messages (visitor_id, created_at);
create index if not exists site_chat_messages_created_idx
  on public.site_chat_messages (created_at desc);
create index if not exists site_chat_messages_unanswered_idx
  on public.site_chat_messages (status, created_at desc)
  where status = 'UNANSWERED';

alter table public.site_visitors      enable row level security;
alter table public.site_chat_messages enable row level security;

-- القراءة لمدير المنصة وحده. لا سياسة كتابة إطلاقًا: الإدراج يتم
-- بمفتاح الخدمة الذي يتجاوز RLS، فلا يستطيع أي عميل تلويث البيانات.
drop policy if exists site_visitors_select on public.site_visitors;
create policy site_visitors_select on public.site_visitors
  for select to authenticated
  using (public.is_super_admin());

drop policy if exists site_chat_messages_select on public.site_chat_messages;
create policy site_chat_messages_select on public.site_chat_messages
  for select to authenticated
  using (public.is_super_admin());

grant select on public.site_visitors, public.site_chat_messages to authenticated;
grant all on public.site_visitors, public.site_chat_messages to service_role;

-- ---------- إحصاءات الزوّار (لمدير المنصة) ----------

create or replace function public.platform_visitor_stats(p_days int default 30)
returns table (
  visitors_total     bigint,
  visitors_in_period bigint,
  questions_total    bigint,
  answered_count     bigint,
  unanswered_count   bigint,
  converted_count    bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_since timestamptz;
begin
  if not public.is_super_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  v_since := now() - make_interval(days => greatest(coalesce(p_days, 30), 1));

  return query
  select
    (select count(*) from public.site_visitors),
    (select count(*) from public.site_visitors v where v.first_seen_at >= v_since),
    (select count(*) from public.site_chat_messages m
       where m.role = 'USER' and m.created_at >= v_since),
    (select count(*) from public.site_chat_messages m
       where m.status = 'ANSWERED' and m.created_at >= v_since),
    (select count(*) from public.site_chat_messages m
       where m.status = 'UNANSWERED' and m.created_at >= v_since),
    (select count(*) from public.site_visitors v
       where v.converted and v.last_seen_at >= v_since);
end;
$$;

-- ---------- أسئلة الزوّار التي لم تُجب ----------
-- هذه أثمن مخرجات المحادثة التسويقية: ما الذي يسأل عنه المهتمّون ولا
-- يجدون له جوابًا في الموقع.

create or replace function public.platform_visitor_unanswered(p_limit int default 20)
returns table (
  question   text,
  asked_at   timestamptz
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

  p_limit := least(greatest(coalesce(p_limit, 20), 1), 100);

  return query
  select q.content, q.created_at
  from public.site_chat_messages a
  join lateral (
    select m.content, m.created_at
    from public.site_chat_messages m
    where m.visitor_id = a.visitor_id
      and m.role = 'USER'
      and m.created_at <= a.created_at
    order by m.created_at desc
    limit 1
  ) q on true
  where a.status = 'UNANSWERED'
  order by a.created_at desc
  limit p_limit;
end;
$$;

-- =====================================================================
-- (ب) توسعة تحليلات الشركة
-- =====================================================================

-- ---------- جودة الإجابات ----------

create or replace function public.company_answer_quality(p_days int default 30)
returns table (
  answers_total      bigint,
  answers_with_source bigint,
  avg_latency_ms     int,
  feedback_up        bigint,
  feedback_down      bigint,
  feedback_total     bigint
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
    count(*) filter (where m.feedback is not null)
  from public.messages m
  where m.company_id = v_company
    and m.created_at >= v_since;
end;
$$;

-- ---------- المستخدمون النشطون ----------
-- «نشط» = طرح سؤالًا واحدًا على الأقل خلال المدة. الفرق بين هذا وعدد
-- الحسابات هو المؤشر الحقيقي لتبنّي النظام داخل الشركة.

create or replace function public.company_active_users(p_days int default 30)
returns table (
  active_users   bigint,
  total_users    bigint,
  new_users      bigint,
  top_user_name  text,
  top_user_questions bigint
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
  with top_asker as (
    select p.full_name, count(*) as asked
    from public.messages m
    join public.profiles p on p.id = m.user_id
    where m.company_id = v_company and m.role = 'USER' and m.created_at >= v_since
    group by p.full_name
    order by count(*) desc
    limit 1
  )
  select
    (select count(distinct m.user_id) from public.messages m
       where m.company_id = v_company and m.role = 'USER' and m.created_at >= v_since),
    (select count(*) from public.profiles p
       where p.company_id = v_company and p.status = 'ACTIVE'),
    (select count(*) from public.profiles p
       where p.company_id = v_company and p.created_at >= v_since),
    (select t.full_name from top_asker t),
    (select t.asked from top_asker t);
end;
$$;

-- ---------- ساعات الذروة ----------

create or replace function public.company_hourly_activity(p_days int default 30)
returns table (
  hour_of_day int,
  questions   bigint
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
  select h.hour::int, coalesce(count(m.id), 0)
  from generate_series(0, 23) as h(hour)
  left join public.messages m
    on m.company_id = v_company
   and m.role = 'USER'
   and m.created_at >= v_since
   and extract(hour from m.created_at at time zone 'Asia/Riyadh') = h.hour
  group by h.hour
  order by h.hour;
end;
$$;

-- ---------- التكلفة والاستهلاك ----------

create or replace function public.company_cost_summary(p_months int default 6)
returns table (
  period_month       date,
  questions_count    int,
  input_tokens       bigint,
  output_tokens      bigint,
  estimated_cost_usd numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  select company_id into v_company
  from public.profiles where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  p_months := least(greatest(coalesce(p_months, 6), 1), 24);

  return query
  select u.period_month, u.questions_count, u.input_tokens, u.output_tokens,
         u.estimated_cost_usd
  from public.usage_records u
  where u.company_id = v_company
    and u.period_month >= date_trunc('month', now())::date
                          - make_interval(months => p_months - 1)
  order by u.period_month;
end;
$$;

-- ---------- الصلاحيات ----------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'company_answer_quality(int)',
    'company_active_users(int)',
    'company_hourly_activity(int)',
    'company_cost_summary(int)',
    'platform_visitor_stats(int)',
    'platform_visitor_unanswered(int)'
  ]
  loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;
