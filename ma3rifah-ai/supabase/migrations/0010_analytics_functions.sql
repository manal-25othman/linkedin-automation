-- =====================================================================
-- 0010 — دوال التحليلات
-- كلها تشتق الشركة من auth.uid() ولا تقبل معرّف شركة من العميل.
-- =====================================================================

-- ---------- إحصاءات لوحة التحكم ----------

create or replace function public.company_dashboard_stats()
returns table (
  users_count           bigint,
  documents_count       bigint,
  documents_ready       bigint,
  documents_processing  bigint,
  conversations_count   bigint,
  questions_count       bigint,
  answered_count        bigint,
  unanswered_count      bigint,
  open_gaps_count       bigint
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

  return query
  select
    (select count(*) from public.profiles p
       where p.company_id = v_company and p.status = 'ACTIVE'),
    (select count(*) from public.documents d
       where d.company_id = v_company and d.status <> 'ARCHIVED'),
    (select count(*) from public.documents d
       where d.company_id = v_company and d.status = 'READY'),
    (select count(*) from public.documents d
       where d.company_id = v_company and d.status = 'PROCESSING'),
    (select count(*) from public.conversations c
       where c.company_id = v_company),
    (select count(*) from public.messages m
       where m.company_id = v_company and m.role = 'USER'),
    (select count(*) from public.messages m
       where m.company_id = v_company and m.answer_status = 'ANSWERED'),
    (select count(*) from public.messages m
       where m.company_id = v_company and m.answer_status = 'UNANSWERED'),
    (select count(*) from public.knowledge_gaps g
       where g.company_id = v_company and g.status = 'OPEN');
end;
$$;

-- ---------- أكثر الأسئلة تداولًا ----------
-- تجميع الأسئلة المتشابهة عبر نفس دالة التطبيع المستخدمة في فجوات المعرفة.

create or replace function public.company_top_questions(p_limit int default 8)
returns table (
  question    text,
  times_asked bigint,
  answered    bigint,
  unanswered  bigint
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

  p_limit := least(greatest(coalesce(p_limit, 8), 1), 50);

  return query
  with user_questions as (
    select
      m.id,
      m.content,
      m.conversation_id,
      m.created_at,
      public.normalize_question(m.content) as normalized
    from public.messages m
    where m.company_id = v_company
      and m.role = 'USER'
      and length(public.normalize_question(m.content)) >= 3
  ),
  paired as (
    select
      q.normalized,
      q.content,
      (
        select a.answer_status
        from public.messages a
        where a.conversation_id = q.conversation_id
          and a.role = 'ASSISTANT'
          and a.created_at >= q.created_at
        order by a.created_at
        limit 1
      ) as status
    from user_questions q
  )
  select
    (array_agg(p.content order by length(p.content)))[1] as question,
    count(*) as times_asked,
    count(*) filter (where p.status = 'ANSWERED') as answered,
    count(*) filter (where p.status = 'UNANSWERED') as unanswered
  from paired p
  group by p.normalized
  order by count(*) desc, question
  limit p_limit;
end;
$$;

-- ---------- سلسلة زمنية للأسئلة ----------

create or replace function public.company_questions_timeseries(p_days int default 30)
returns table (
  day        date,
  total      bigint,
  answered   bigint,
  unanswered bigint
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

  p_days := least(greatest(coalesce(p_days, 30), 1), 365);

  return query
  select
    series.day::date,
    count(m.id) as total,
    count(m.id) filter (where m.answer_status = 'ANSWERED') as answered,
    count(m.id) filter (where m.answer_status = 'UNANSWERED') as unanswered
  from generate_series(
         (current_date - (p_days - 1) * interval '1 day'),
         current_date,
         interval '1 day'
       ) as series(day)
  left join public.messages m
    on m.company_id = v_company
   and m.role = 'ASSISTANT'
   and m.created_at >= series.day
   and m.created_at < series.day + interval '1 day'
  group by series.day
  order by series.day;
end;
$$;

-- ---------- أكثر المستندات استخدامًا ----------

create or replace function public.company_top_documents(p_limit int default 8)
returns table (
  document_id   uuid,
  document_name text,
  citations     bigint
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

  p_limit := least(greatest(coalesce(p_limit, 8), 1), 50);

  return query
  select
    s.document_id,
    max(s.document_name) as document_name,
    count(*) as citations
  from public.message_sources s
  where s.company_id = v_company
    and s.document_id is not null
  group by s.document_id
  order by count(*) desc
  limit p_limit;
end;
$$;

-- ---------- الاستخدام حسب القسم ----------

create or replace function public.company_department_usage()
returns table (
  department_id   uuid,
  department_name text,
  questions       bigint,
  active_users    bigint
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

  return query
  select
    d.id,
    d.name,
    count(m.id) as questions,
    count(distinct m.user_id) as active_users
  from public.departments d
  left join public.profiles p
    on p.department_id = d.id and p.company_id = v_company
  left join public.messages m
    on m.user_id = p.id and m.role = 'USER' and m.company_id = v_company
  where d.company_id = v_company
  group by d.id, d.name
  order by count(m.id) desc, d.name;
end;
$$;

-- ---------- آخر النشاطات ----------

create or replace function public.company_recent_activity(p_limit int default 12)
returns table (
  id          uuid,
  action      text,
  entity_type text,
  actor_name  text,
  metadata    jsonb,
  created_at  timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_role public.user_role;
begin
  select company_id, role into v_company, v_role
  from public.profiles where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  -- النشاط الإداري مرئي للمديرين فقط
  if v_role not in ('SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER') then
    return;
  end if;

  p_limit := least(greatest(coalesce(p_limit, 12), 1), 50);

  return query
  select
    a.id,
    a.action,
    a.entity_type,
    coalesce(p.full_name, a.actor_email, 'النظام') as actor_name,
    a.metadata,
    a.created_at
  from public.audit_logs a
  left join public.profiles p on p.id = a.actor_id
  where a.company_id = v_company
    and a.action not in ('auth.login')
  order by a.created_at desc
  limit p_limit;
end;
$$;

-- ---------- استخدام الشركة مقابل حدود الخطة ----------

create or replace function public.company_usage_summary()
returns table (
  plan_name              text,
  plan_code              text,
  subscription_status    text,
  period_end             timestamptz,
  users_used             bigint,
  users_limit            int,
  documents_used         bigint,
  documents_limit        int,
  questions_used         int,
  questions_limit        int
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

  return query
  select
    pl.name,
    pl.code,
    s.status::text,
    s.current_period_end,
    (select count(*) from public.profiles p
       where p.company_id = v_company and p.status = 'ACTIVE'),
    coalesce(nullif(s.limit_overrides ->> 'max_users', '')::int, pl.max_users),
    (select count(*) from public.documents d
       where d.company_id = v_company and d.status <> 'ARCHIVED'),
    coalesce(nullif(s.limit_overrides ->> 'max_documents', '')::int, pl.max_documents),
    coalesce((select u.questions_count from public.usage_records u
       where u.company_id = v_company
         and u.period_month = date_trunc('month', now())::date), 0),
    coalesce(nullif(s.limit_overrides ->> 'max_questions_monthly', '')::int,
             pl.max_questions_monthly)
  from public.subscriptions s
  join public.plans pl on pl.id = s.plan_id
  where s.company_id = v_company;
end;
$$;

-- ---------- الصلاحيات ----------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'company_dashboard_stats()',
    'company_top_questions(int)',
    'company_questions_timeseries(int)',
    'company_top_documents(int)',
    'company_department_usage()',
    'company_recent_activity(int)',
    'company_usage_summary()'
  ]
  loop
    execute format('revoke all on function public.%s from public', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;
