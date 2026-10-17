-- =====================================================================
-- 0042 — تصحيحات على نظام الإصدارات
--
-- أربعة تصحيحات على `0041`، وكلها تضييقٌ لا توسيع:
--
-- (١) **لا تفعيل تلقائي لأول إصدار.** اكتمال الفهرسة يجعل الوثيقة
--     *جاهزة للاعتماد* لا *مرجعًا للإجابات*. وكان في `0041` استثناءٌ
--     يفعّل أول إصدار في العائلة تلقائيًا، حفاظًا على سهولة التجهيز —
--     وهو خطأ: السهولة لا تُشترى بأن تُجيب المنصّة من وثيقة لم يقرأها
--     أحد. والتجهيز يُحلّ بخطوة ظاهرة لا بتفعيل صامت.
--
-- (٢) **استثناء الترحيل لا يُمنح لرفع جديد.** الوثائق السابقة تبقى
--     تخدم بحالة `MIGRATED_UNREVIEWED`، وهذه الحالة لا تُسنَد بعد اليوم
--     إلى أي صفّ جديد — ويحرسها قيدٌ لا عُرف.
--
-- (٣) **تاريخ السريان المستقبلي لا يبدّل المرجع فورًا.** كان الاعتماد
--     يحرّك المؤشّر مهما كان التاريخ، فيصير إصدارٌ «يسري بعد شهر»
--     مرجعًا اليوم. والآن: الاعتماد يثبّت القرار، والتفعيل يقع في موعده.
--
-- (٤) **ظهور العائلة يتبع صلاحيات إصداراتها.** كانت سياسة العائلة
--     بحدّ الشركة وحده، فيرى موظفٌ **عنوان** وثيقةٍ كل إصداراتها محجوبة
--     عنه بالقسم أو الدور. والعنوان نفسه معلومة: «سياسة إنهاء خدمات
--     القسم الفلاني» تكشف ما لا يحقّ له.
-- =====================================================================

-- ---------- (١) إلغاء التفعيل التلقائي ----------

drop trigger if exists documents_activate_first_version on public.documents;
drop trigger if exists documents_activate_on_insert on public.documents;
drop function if exists public.activate_first_version();
drop function if exists public.activate_first_version_on_insert();

-- ---------- (٢) حالة الترحيل محجوزة للترحيل ----------

/*
 * القيد يمنع إسناد `MIGRATED_UNREVIEWED` إلى صفٍّ أُنشئ بعد الترحيل.
 *
 * والتمييز بالزمن لا بالنيّة: الترحيل وقع في `0041` ولحظته معروفة،
 * فكل صفٍّ أحدث منها لا يحقّ له الحالة. وعُرفٌ مكتوب في تعليق يُخالَف
 * بعد شهرين؛ القيد لا يُخالَف.
 */
create or replace function public.assert_migration_status_not_granted()
returns trigger
language plpgsql
as $$
begin
  if new.approval_status = 'MIGRATED_UNREVIEWED'
     and not exists (
       select 1 from public.document_version_events e
        where e.document_id = new.id and e.event = 'MIGRATED'
     ) then
    raise exception 'migration_status_reserved'
      using hint = 'حالة الترحيل للوثائق السابقة لنظام الإصدارات وحدها';
  end if;
  return new;
end;
$$;

drop trigger if exists documents_migration_status_guard on public.documents;
create trigger documents_migration_status_guard
  before insert or update of approval_status on public.documents
  for each row execute function public.assert_migration_status_not_granted();

-- ---------- (٣) الاعتماد: القرار الآن، والتفعيل في موعده ----------

/*
 * `scheduled_from` ليس عمودًا جديدًا: `documents.effective_from` يحمل
 * التاريخ أصلًا. المطلوب أن **المؤشّر** لا يتحرك قبله.
 *
 * واتجاه الفشل مقصود: لو تأخّر التفعيل المجدول (لم تُشغَّل المهمة
 * الدورية) **بقي الإصدار القديم يُجيب**. وهذا الاتجاه الآمن: تأخّرُ
 * سياسةٍ جديدة يومًا أهون من سريانها قبل موعدها.
 */
create or replace function public.approve_document_version(
  p_document_id   uuid,
  p_effective_from date default null,
  p_note          text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_company   uuid := public.current_company_id();
  v_family    uuid;
  v_status    public.document_status;
  v_previous  uuid;
  v_interval  int;
  v_from      date := coalesce(p_effective_from, current_date);
  v_due_now   boolean;
begin
  if v_company is null or not public.is_company_admin() then
    raise exception 'not_authorized';
  end if;

  select d.family_id, d.status
    into v_family, v_status
    from public.documents d
   where d.id = p_document_id
     and d.company_id = v_company;

  if v_family is null then
    raise exception 'document_not_found';
  end if;

  -- الفهرسة شرط الاعتماد. والاعتماد قبلها يعني مرجعًا لا مقاطع له،
  -- أي سياسةً «معتمدة» لا يجدها السؤال.
  if v_status <> 'READY' then
    raise exception 'document_not_indexed';
  end if;

  v_due_now := v_from <= current_date;

  select f.effective_document_id, f.review_interval_months
    into v_previous, v_interval
    from public.document_families f
   where f.id = v_family and f.company_id = v_company;

  -- (أ) القرار يُثبَّت دائمًا — بتاريخه، حاضرًا كان أو مستقبلًا
  update public.documents
     set approval_status        = 'APPROVED',
         approved_by            = auth.uid(),
         approved_at            = now(),
         effective_from         = v_from,
         supersedes_document_id = case
             when v_previous is not null and v_previous <> p_document_id
             then v_previous else supersedes_document_id end
   where id = p_document_id and company_id = v_company;

  insert into public.document_version_events
    (company_id, family_id, document_id, event, actor_id, note)
  values (v_company, v_family, p_document_id, 'APPROVED', auth.uid(),
          case when v_due_now then p_note
               else coalesce(p_note || ' · ', '') || 'يسري من ' || v_from::text
          end);

  -- (ب) والتفعيل مشروط بالموعد
  if not v_due_now then
    insert into public.document_version_events
      (company_id, family_id, document_id, event, actor_id, note)
    values (v_company, v_family, p_document_id, 'SCHEDULED', auth.uid(),
            'لن يصير مرجعًا قبل ' || v_from::text);
    return v_family;
  end if;

  if v_previous is not null and v_previous <> p_document_id then
    update public.documents
       set approval_status = 'SUPERSEDED'
     where id = v_previous and company_id = v_company;

    insert into public.document_version_events
      (company_id, family_id, document_id, event, actor_id, note)
    values (v_company, v_family, v_previous, 'SUPERSEDED', auth.uid(),
            'استبدله إصدار أحدث');
  end if;

  update public.document_families
     set effective_document_id = p_document_id,
         last_reviewed_at      = now(),
         review_due_at         = case
             when v_interval is not null
             then (current_date + (v_interval || ' months')::interval)::date
             else review_due_at
           end
   where id = v_family and company_id = v_company;

  return v_family;
end;
$$;

revoke all on function public.approve_document_version(uuid, date, text) from public;
grant execute on function public.approve_document_version(uuid, date, text) to authenticated;

-- حدثان جديدان في النوع
do $$ begin
  alter type public.doc_version_event add value if not exists 'SCHEDULED';
exception when others then null; end $$;
do $$ begin
  alter type public.doc_version_event add value if not exists 'ACTIVATED_ON_SCHEDULE';
exception when others then null; end $$;

-- =====================================================================
-- تفعيل الإصدارات المستحقّة — يُنادى من مهمة دورية
--
-- ويعمل بمفتاح الخدمة لا بجلسة مستخدم: المهمة الدورية لا هوية لها،
-- ولذلك **لا يُمنح تنفيذها لأي دور مصادَق**.
--
-- وثلاث حالات معالجة صراحةً:
--   • الإصدار المجدول لم تكتمل فهرسته ⇒ يُتخطّى، ويبقى القديم يُجيب،
--     ويُسجَّل الأمر حدثًا كي لا يمرّ صامتًا.
--   • لا إصدار مستحقّ ⇒ لا تغيير.
--   • عدة إصدارات مستحقّة ⇒ يُفعَّل أحدثها سريانًا (ثم أحدثها اعتمادًا).
-- =====================================================================

create or replace function public.activate_due_document_versions()
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r record;
  v_count int := 0;
begin
  for r in
    select distinct on (d.family_id)
           d.id, d.family_id, d.company_id, d.effective_from,
           f.effective_document_id as current_effective
      from public.documents d
      join public.document_families f on f.id = d.family_id
     where d.approval_status = 'APPROVED'
       and d.status = 'READY'
       and d.effective_from is not null
       and d.effective_from <= current_date
       and (f.effective_document_id is null or f.effective_document_id <> d.id)
     order by d.family_id, d.effective_from desc, d.approved_at desc
  loop
    -- الإصدار الذي يُستبدل
    if r.current_effective is not null then
      update public.documents
         set approval_status = 'SUPERSEDED'
       where id = r.current_effective and company_id = r.company_id;
    end if;

    update public.document_families
       set effective_document_id = r.id
     where id = r.family_id and company_id = r.company_id;

    insert into public.document_version_events
      (company_id, family_id, document_id, event, actor_id, note)
    values (r.company_id, r.family_id, r.id, 'ACTIVATED_ON_SCHEDULE', null,
            'بلغ تاريخ سريانه ' || r.effective_from::text);

    v_count := v_count + 1;
  end loop;

  -- إصدارات مستحقّة لم تكتمل فهرستها: تُسجَّل ولا تُفعَّل
  insert into public.document_version_events
    (company_id, family_id, document_id, event, actor_id, note)
  select d.company_id, d.family_id, d.id, 'SCHEDULED', null,
         'بلغ تاريخ سريانه ولم تكتمل فهرسته — بقي الإصدار السابق مرجعًا'
    from public.documents d
   where d.approval_status = 'APPROVED'
     and d.status <> 'READY'
     and d.effective_from is not null
     and d.effective_from <= current_date
     and not exists (
       select 1 from public.document_version_events e
        where e.document_id = d.id
          and e.event = 'SCHEDULED'
          and e.created_at > current_date - 1
     );

  return v_count;
end;
$$;

revoke all on function public.activate_due_document_versions() from public;
revoke all on function public.activate_due_document_versions() from authenticated;

-- =====================================================================
-- حاجز زمنيّ في الاسترجاع نفسه
--
-- المؤشّر هو المرجع، وهذا شرطٌ ثانٍ فوقه: ولو حُرّك المؤشّر خطأً إلى
-- إصدارٍ لم يسرِ بعد، لا يُجيب. والحاجزان لا يغنيان عن بعضهما: الأول
-- يصف القرار، والثاني يصف الزمن.
-- =====================================================================

create or replace function public.match_document_chunks_hybrid(
  p_query_embedding vector(1024),
  p_query_text text,
  p_match_count int default 8,
  p_min_similarity real default 0.30,
  p_category_ids uuid[] default null
)
returns table (
  chunk_id      uuid,
  document_id   uuid,
  document_name text,
  content       text,
  page_number   int,
  section_title text,
  similarity    real,
  lexical_rank  real,
  fused_score   real,
  matched_by    text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_role    public.user_role;
  v_dept    uuid;
  v_query   tsquery;
  v_terms   text;
  k         constant int := 60;
  v_pool    int := greatest(p_match_count * 3, 30);
begin
  select company_id, role, department_id
    into v_company, v_role, v_dept
  from public.profiles
  where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    return;
  end if;

  select coalesce(string_agg(distinct w, ' | '), '')
    into v_terms
  from unnest(
         string_to_array(
           regexp_replace(public.ar_stem(p_query_text), '[^[:alnum:] ]+', ' ', 'g'),
           ' '
         )
       ) as w
  where length(w) >= 2;

  if v_terms = '' then
    v_query := null;
  else
    begin
      v_query := to_tsquery('simple', v_terms);
    exception when others then
      v_query := plainto_tsquery('simple', public.ar_stem(p_query_text));
    end;
  end if;

  return query
  with visible as (
    select c.id, c.document_id, d.name as document_name, c.content,
           c.page_number, c.section_title, c.embedding, c.content_tsv
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    join public.document_families f
      on f.id = d.family_id
     and f.company_id = d.company_id
     and f.effective_document_id = d.id
    where c.company_id = v_company
      and d.company_id = v_company
      and d.status = 'READY'
      -- الحاجز الزمنيّ: ما لم يسرِ لا يُجيب
      and (d.effective_from is null or d.effective_from <= current_date)
      and c.embedding is not null
      and (p_category_ids is null or d.category_id = any (p_category_ids))
      and (
        v_role = 'COMPANY_ADMIN'
        or d.visibility = 'COMPANY'
        or (d.visibility = 'DEPARTMENT'
            and v_dept is not null
            and v_dept = any (d.allowed_department_ids))
        or (d.visibility = 'ROLE' and v_role = any (d.allowed_roles))
      )
  ),
  dense as (
    select v.id,
           (1 - (v.embedding <=> p_query_embedding))::real as sim,
           row_number() over (order by v.embedding <=> p_query_embedding) as rnk
    from visible v
    where (1 - (v.embedding <=> p_query_embedding)) >= p_min_similarity
    order by v.embedding <=> p_query_embedding
    limit v_pool
  ),
  sparse as (
    select v.id,
           ts_rank(v.content_tsv, v_query)::real as rank,
           row_number() over (order by ts_rank(v.content_tsv, v_query) desc) as rnk
    from visible v
    where v_query is not null and v.content_tsv @@ v_query
    order by ts_rank(v.content_tsv, v_query) desc
    limit v_pool
  ),
  fused as (
    select coalesce(d.id, s.id) as id,
           coalesce(d.sim, 0)::real  as sim,
           coalesce(s.rank, 0)::real as rank,
           (coalesce(1.0 / (k + d.rnk), 0) + coalesce(1.0 / (k + s.rnk), 0))::real as score,
           case
             when d.id is not null and s.id is not null then 'both'
             when d.id is not null then 'dense'
             else 'sparse'
           end as matched_by
    from dense d
    full outer join sparse s on s.id = d.id
  )
  select v.id, v.document_id, v.document_name, v.content, v.page_number,
         v.section_title, f.sim, f.rank, f.score, f.matched_by
  from fused f
  join visible v on v.id = f.id
  order by f.score desc, f.sim desc
  limit p_match_count;
end;
$$;

revoke all on function public.match_document_chunks_hybrid(vector, text, int, real, uuid[]) from public;
grant execute on function public.match_document_chunks_hybrid(vector, text, int, real, uuid[]) to authenticated;

-- =====================================================================
-- (٤) ظهور العائلة يتبع صلاحيات إصداراتها
--
-- والعنوان نفسه معلومة: «لائحة إنهاء خدمات قسم المشتريات» تكشف ما لا
-- يحقّ لموظفٍ آخر معرفته، ولو لم يُفتح أي ملف.
--
-- فالقاعدة: تُرى العائلة إن كان للمستخدم **إصدارٌ واحد على الأقل**
-- يحقّ له قراءته. وتُستعمل `can_read_document` نفسها لا نسخةٌ منها —
-- فمنطقُ رؤيةٍ مكرَّر يتباعد عن أصله بأول تعديل.
-- =====================================================================

create or replace function public.can_read_document_family(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.documents d
     where d.family_id = p_family_id
       and public.can_read_document(
             d.company_id, d.visibility, d.allowed_department_ids, d.allowed_roles)
  );
$$;

revoke all on function public.can_read_document_family(uuid) from public;
grant execute on function public.can_read_document_family(uuid) to authenticated;

drop policy if exists document_families_select on public.document_families;
create policy document_families_select on public.document_families
  for select to authenticated
  using (
    public.belongs_to_current_company(company_id)
    and public.can_read_document_family(id)
  );

-- وسجلّ الأحداث كذلك: حدثٌ على إصدارٍ محجوب يكشف وجوده وتواريخه.
drop policy if exists document_version_events_select on public.document_version_events;
create policy document_version_events_select on public.document_version_events
  for select to authenticated
  using (
    public.belongs_to_current_company(company_id)
    and public.is_manager_or_above()
    and public.can_read_document_family(family_id)
  );

-- =====================================================================
-- معاينة الإصدار قبل اعتماده — لمدير الشركة وحده
--
-- بديل التفعيل التلقائي الذي أُلغي: من أراد تجربة محتوى وثيقة قبل
-- اعتمادها جرّبها هنا، **معزولةً عن إجابات الموظفين تمامًا**.
--
-- وهي مقصورة على مدير الشركة لا على «من يرى المستند»: الإصدار غير
-- المعتمد نصٌّ لم يُقرَّ، ورؤيته لموظفٍ تعني أنه قد يعمل به.
-- =====================================================================

create or replace function public.preview_document_version_chunks(
  p_document_id uuid,
  p_query_embedding vector(1024),
  p_match_count int default 6
)
returns table (
  chunk_id      uuid,
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
  v_company uuid := public.current_company_id();
begin
  if v_company is null or not public.is_company_admin() then
    return;
  end if;

  return query
  select c.id, c.content, c.page_number, c.section_title,
         (1 - (c.embedding <=> p_query_embedding))::real
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
   where c.document_id = p_document_id
     and c.company_id = v_company
     and d.company_id = v_company
     and c.embedding is not null
   order by c.embedding <=> p_query_embedding
   limit greatest(1, least(coalesce(p_match_count, 6), 20));
end;
$$;

revoke all on function public.preview_document_version_chunks(uuid, vector, int) from public;
grant execute on function public.preview_document_version_chunks(uuid, vector, int) to authenticated;

-- =====================================================================
-- قائمة الوثائق المنتظرة مراجعة — للتنبيه الإداري
--
-- تشمل المرحَّلة التي لم يُقرَّر اعتمادها، والجاهزة التي لم تُعتمد،
-- والعائلة التي لا مرجع لها أصلًا.
-- =====================================================================

create or replace function public.families_awaiting_review()
returns table (
  family_id        uuid,
  title            text,
  reason           text,
  pending_document uuid,
  updated_at       timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid := public.current_company_id();
begin
  if v_company is null or not public.is_company_admin() then
    return;
  end if;

  return query
  select f.id, f.title,
         case
           when f.effective_document_id is null then 'NO_REFERENCE'
           when eff.approval_status = 'MIGRATED_UNREVIEWED' then 'MIGRATED_UNREVIEWED'
           else 'PENDING_VERSION'
         end as reason,
         (select d2.id from public.documents d2
           where d2.family_id = f.id
             and d2.status = 'READY'
             and d2.approval_status in ('DRAFT', 'IN_REVIEW')
           order by d2.created_at desc limit 1) as pending_document,
         f.updated_at
    from public.document_families f
    left join public.documents eff on eff.id = f.effective_document_id
   where f.company_id = v_company
     and (
       f.effective_document_id is null
       or eff.approval_status = 'MIGRATED_UNREVIEWED'
       or exists (
         select 1 from public.documents d3
          where d3.family_id = f.id
            and d3.status = 'READY'
            and d3.approval_status in ('DRAFT', 'IN_REVIEW')
       )
     )
   order by f.updated_at desc;
end;
$$;

revoke all on function public.families_awaiting_review() from public;
grant execute on function public.families_awaiting_review() to authenticated;
