-- =====================================================================
-- 0006 — الدوال المساعدة، البحث الدلالي، وتسجيل فجوات المعرفة
-- كل الدوال هنا تشتق هوية المستخدم من auth.uid() ولا تثق بأي
-- معرّف شركة يمرّره العميل.
-- =====================================================================

-- ---------- دوال سياق المستخدم ----------
-- SECURITY DEFINER لتجنّب التكرار اللانهائي في سياسات RLS على profiles.

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles
  where id = auth.uid() and status = 'ACTIVE'
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles
  where id = auth.uid() and status = 'ACTIVE'
$$;

create or replace function public.current_department_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select department_id from public.profiles
  where id = auth.uid() and status = 'ACTIVE'
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'SUPER_ADMIN' and status = 'ACTIVE'
  )
$$;

create or replace function public.is_company_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('SUPER_ADMIN', 'COMPANY_ADMIN')
      and status = 'ACTIVE'
  )
$$;

create or replace function public.is_manager_or_above()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER')
      and status = 'ACTIVE'
  )
$$;

-- ينتمي السجل إلى شركة المستخدم الحالي (أو المستخدم مدير منصة)
create or replace function public.belongs_to_current_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
     or (p_company_id is not null and p_company_id = public.current_company_id())
$$;

-- ---------- صلاحية قراءة مستند ----------

create or replace function public.can_read_document(
  p_company_id uuid,
  p_visibility public.document_visibility,
  p_allowed_department_ids uuid[],
  p_allowed_roles public.user_role[]
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_company uuid;
  v_department uuid;
begin
  if public.is_super_admin() then
    return true;
  end if;

  select role, company_id, department_id
    into v_role, v_company, v_department
  from public.profiles
  where id = auth.uid() and status = 'ACTIVE';

  if v_role is null or v_company is null or v_company <> p_company_id then
    return false;
  end if;

  -- مدير الشركة يرى كل مستندات شركته
  if v_role = 'COMPANY_ADMIN' then
    return true;
  end if;

  return case p_visibility
    when 'COMPANY'    then true
    when 'DEPARTMENT' then v_department is not null
                           and v_department = any (p_allowed_department_ids)
    when 'ROLE'       then v_role = any (p_allowed_roles)
    else false
  end;
end;
$$;

-- ---------- تطبيع نص السؤال ----------
-- يُستخدم لتجميع الأسئلة المتشابهة في فجوة معرفة واحدة.

create or replace function public.normalize_question(p_text text)
returns text
language sql
immutable
as $$
  select btrim(
    regexp_replace(                          -- توحيد المسافات
      regexp_replace(                        -- إزالة الترقيم
        regexp_replace(                      -- إزالة التشكيل والتطويل
          lower(
            translate(p_text, 'أإآٱىة', 'اااايه')   -- توحيد الهمزات والألف المقصورة والتاء المربوطة
          ),
          '[ً-ْـ]', '', 'g'
        ),
        '[^[:alnum:][:space:]]+', ' ', 'g'
      ),
      '\s+', ' ', 'g'
    )
  )
$$;

-- ---------- البحث الدلالي في مقاطع المستندات ----------
-- تُستدعى بجلسة المستخدم (auth.uid موجود). تُطبّق عزل المستأجر
-- وصلاحيات المستندات داخل الدالة نفسها.

-- يُسقَط أي تعريف سابق أولًا — للسبب نفسه المذكور في 0012.
drop function if exists public.match_document_chunks(vector, int, real, uuid[]);

create or replace function public.match_document_chunks(
  p_query_embedding vector(1024),
  p_match_count int default 8,
  p_min_similarity real default 0.30,
  p_category_ids uuid[] default null
)
returns table (
  chunk_id      uuid,
  document_id   uuid,
  document_name text,
  category_id   uuid,
  content       text,
  page_number   int,
  section_title text,
  similarity    real
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_role public.user_role;
  v_department uuid;
begin
  select company_id, role, department_id
    into v_company, v_role, v_department
  from public.profiles
  where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    raise exception 'unauthorized: no active company profile for current user'
      using errcode = '42501';
  end if;

  -- حدّ أعلى صارم لعدد النتائج للتحكم في التكلفة
  p_match_count := least(greatest(coalesce(p_match_count, 8), 1), 20);

  return query
  select
    c.id,
    c.document_id,
    d.name,
    d.category_id,
    c.content,
    c.page_number,
    c.section_title,
    (1 - (c.embedding <=> p_query_embedding))::real as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where c.company_id = v_company
    and d.company_id = v_company
    and d.status = 'READY'
    and c.embedding is not null
    and (p_category_ids is null or d.category_id = any (p_category_ids))
    and (
      v_role = 'COMPANY_ADMIN'
      or d.visibility = 'COMPANY'
      or (d.visibility = 'DEPARTMENT'
          and v_department is not null
          and v_department = any (d.allowed_department_ids))
      or (d.visibility = 'ROLE' and v_role = any (d.allowed_roles))
    )
    and (1 - (c.embedding <=> p_query_embedding)) >= p_min_similarity
  order by c.embedding <=> p_query_embedding
  limit p_match_count;
end;
$$;

-- ---------- تسجيل فجوة معرفة ----------
-- تُستدعى عندما يعجز المساعد عن الإجابة اعتمادًا على قاعدة المعرفة.

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
    set times_asked  = public.knowledge_gaps.times_asked + 1,
        last_asked_at = now(),
        -- إعادة فتح الفجوة إذا سُئلت مجددًا بعد تجاهلها
        status = case
                   when public.knowledge_gaps.status = 'DISMISSED' then 'OPEN'
                   else public.knowledge_gaps.status
                 end
  returning id into v_gap_id;

  return v_gap_id;
end;
$$;

-- ---------- تحديث عدّاد المحادثة ----------

create or replace function public.bump_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
     set message_count = message_count + 1,
         last_message_at = new.created_at,
         updated_at = now()
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_bump_conversation on public.messages;
create trigger messages_bump_conversation
  after insert on public.messages
  for each row execute function public.bump_conversation_on_message();

-- ---------- تسجيل الاستهلاك الشهري ----------

create or replace function public.record_usage(
  p_company_id uuid,
  p_questions int default 0,
  p_input_tokens bigint default 0,
  p_output_tokens bigint default 0,
  p_cost_usd numeric default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usage_records
    (company_id, period_month, questions_count, input_tokens, output_tokens, estimated_cost_usd)
  values
    (p_company_id, date_trunc('month', now())::date,
     p_questions, p_input_tokens, p_output_tokens, p_cost_usd)
  on conflict (company_id, period_month) do update
    set questions_count    = public.usage_records.questions_count + excluded.questions_count,
        input_tokens       = public.usage_records.input_tokens + excluded.input_tokens,
        output_tokens      = public.usage_records.output_tokens + excluded.output_tokens,
        estimated_cost_usd = public.usage_records.estimated_cost_usd + excluded.estimated_cost_usd,
        updated_at         = now();
end;
$$;

-- ---------- التحقق من حدود الخطة قبل السؤال ----------

create or replace function public.check_question_quota()
returns table (allowed boolean, used int, quota int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_quota int;
  v_override int;
  v_used int;
begin
  select company_id into v_company
  from public.profiles where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    return query select false, 0, 0;
    return;
  end if;

  select p.max_questions_monthly,
         nullif(s.limit_overrides ->> 'max_questions_monthly', '')::int
    into v_quota, v_override
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.company_id = v_company;

  v_quota := coalesce(v_override, v_quota);

  select coalesce(u.questions_count, 0) into v_used
  from public.usage_records u
  where u.company_id = v_company
    and u.period_month = date_trunc('month', now())::date;

  v_used := coalesce(v_used, 0);

  -- لا اشتراك أو خطة بلا حد => مسموح
  if v_quota is null then
    return query select true, v_used, -1;
  else
    return query select (v_used < v_quota), v_used, v_quota;
  end if;
end;
$$;
