-- =====================================================================
-- 0041 — هوية الوثيقة وإصداراتها (Document families & versions)
--
-- القرار المعماري، وهو أهم ما في هذه الترحيلة:
--
--   صفّ `documents` **هو إصدار**، لا وثيقة. وهذا ليس اختراعًا جديدًا:
--   الصفّ يملك ملفه ومقاطعه وحالة فهرسته وعدّاد `version` أصلًا. فما
--   ينقص ليس تفكيكه، بل **هويةٌ ثابتة فوقه** تجمع إصداراته.
--
--   ولذلك تُضاف `document_families` أعلى `documents` ولا يُفكَّك
--   `documents`. والسبب أن `document_chunks` و`message_sources`
--   و`document_ocr_pages` و`can_read_document()`
--   و`match_document_chunks_hybrid` كلها تُمسك بـ`documents.id`:
--   تفكيكه يعني إعادة كتابة بوابة العزل بين المستأجرين — وهي الضمانة
--   التي يحرسها ٢٧١ اختبارًا واختبارُ طفرات. ولا يُلمس حارسٌ يعمل
--   لأجل ترتيبٍ أجمل.
--
--   ومكسب مجاني من هذا الاختيار: `message_sources.document_id` يشير
--   **إلى الإصدار بعينه** أصلًا، فالاستشهادات محدَّدة الإصدار منذ
--   اليوم الأول بلا أي ترحيل.
--
-- والقاعدة الحاكمة: **حداثة الرفع لا تعني المرجعية.** الإصدار الفعّال
-- يُشار إليه صراحةً من العائلة، ولا يصير فعّالًا قبل اكتمال فهرسته.
-- =====================================================================

-- ---------- الأنواع ----------

do $$ begin
  create type public.doc_approval_status as enum (
    'DRAFT',                -- مسودة: مرفوعة، ليست مرجعًا
    'IN_REVIEW',            -- قيد المراجعة
    'APPROVED',             -- معتمدة بقرار موثَّق
    'ARCHIVED',             -- مؤرشفة
    'SUPERSEDED',           -- استبدلها إصدار أحدث
    'MIGRATED_UNREVIEWED'   -- وثيقة سابقة للترحيل: تعمل، ولم يُقرَّر اعتمادها
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.doc_version_event as enum (
    'UPLOADED', 'SUBMITTED_FOR_REVIEW', 'APPROVED', 'ARCHIVED',
    'SUPERSEDED', 'REVIEWED_NO_CHANGE', 'FIRST_EFFECTIVE', 'MIGRATED'
  );
exception when duplicate_object then null; end $$;

-- ---------- الهوية الثابتة للوثيقة ----------

create table if not exists public.document_families (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies(id) on delete cascade,
  title                 text not null,
  category_id           uuid references public.knowledge_categories(id) on delete set null,
  -- القسم المالك للمحتوى — للعرض والتصفية، **لا للصلاحيات**.
  -- الصلاحيات تبقى على الإصدار نفسه (`documents.visibility`) كما هي.
  department_id         uuid references public.departments(id) on delete set null,
  -- المسؤول عن المحتوى: من يُنبَّه عند موعد المراجعة
  content_owner_id      uuid references public.profiles(id) on delete set null,

  /*
   * الإصدار الفعّال — مصدر الإجابات الاعتيادية.
   *
   * مؤشّر واحد صريح، وتغييره يقع في معاملة واحدة داخل
   * `approve_document_version`. وهذا ما يمنع «فترة الخليط»: لا لحظةَ
   * تُجيب فيها المنصّة من نسختين معًا، لأن التبديل ليس بحثًا عن
   * «الأحدث» بل قراءةً لمؤشّر.
   */
  effective_document_id uuid references public.documents(id) on delete set null,

  -- دورة المراجعة. **موعد المراجعة ليس انتهاء سريان**: الوثيقة تبقى
  -- مرجعًا بعد موعد مراجعتها حتى يُقرَّر غير ذلك.
  review_interval_months int check (review_interval_months is null
                                    or review_interval_months between 1 and 120),
  review_due_at         date,
  last_reviewed_at      timestamptz,

  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint document_families_title_not_blank check (length(btrim(title)) > 0)
);

create index if not exists document_families_company_idx
  on public.document_families (company_id, updated_at desc);
create index if not exists document_families_review_due_idx
  on public.document_families (company_id, review_due_at)
  where review_due_at is not null;
create index if not exists document_families_effective_idx
  on public.document_families (effective_document_id);

drop trigger if exists document_families_set_updated_at on public.document_families;
create trigger document_families_set_updated_at
  before update on public.document_families
  for each row execute function public.set_updated_at();

-- ---------- ربط الإصدار بعائلته وحالة اعتماده ----------

alter table public.documents
  add column if not exists family_id uuid
    references public.document_families(id) on delete cascade,
  add column if not exists version_label text,
  add column if not exists approval_status public.doc_approval_status
    not null default 'DRAFT',
  add column if not exists effective_from date,
  add column if not exists supersedes_document_id uuid
    references public.documents(id) on delete set null,
  add column if not exists approved_by uuid
    references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists archived_by uuid
    references public.profiles(id) on delete set null,
  add column if not exists archived_at timestamptz;

comment on column public.documents.family_id is
  'هوية الوثيقة الثابتة. هذا الصفّ إصدارٌ منها.';
comment on column public.documents.approval_status is
  'حالة الاعتماد — **منفصلة تمامًا عن `status`** الذي يصف فهرسة الملف. '
  'وثيقة READY غير معتمدة أمرٌ طبيعي، ووثيقة APPROVED غير READY ممنوعة بالدالّة.';

create index if not exists documents_family_idx
  on public.documents (family_id, created_at desc);
create index if not exists documents_approval_idx
  on public.documents (company_id, approval_status);

-- ---------- سجلّ أحداث الإصدار ----------
-- من رفع، ومن اعتمد، ومن أرشف، ومتى. ولا يُحذف صفّ منه.

create table if not exists public.document_version_events (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  family_id   uuid not null references public.document_families(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  event       public.doc_version_event not null,
  actor_id    uuid references public.profiles(id) on delete set null,
  -- ملاحظة المراجع. نصّ قصير بقرار بشري، لا نسخةٌ من محتوى الوثيقة.
  note        text,
  created_at  timestamptz not null default now(),
  constraint document_version_events_note_len check (note is null or length(note) <= 2000)
);

create index if not exists document_version_events_family_idx
  on public.document_version_events (family_id, created_at desc);

-- =====================================================================
-- الحاجز البنيوي: لا إصدار فعّال قبل اكتمال فهرسته
--
-- مفروض بقيدٍ لا بمراجعةٍ في التطبيق: شرطُ الدالّة يُنسى عند كتابة
-- مسارٍ ثانٍ، والقيد لا يُنسى.
-- =====================================================================

create or replace function public.assert_effective_is_indexed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.effective_document_id is not null then
    if not exists (
      select 1 from public.documents d
      where d.id = new.effective_document_id
        and d.company_id = new.company_id
        and d.family_id  = new.id
        and d.status = 'READY'
    ) then
      raise exception 'effective_version_not_indexed'
        using hint = 'الإصدار الفعّال يجب أن يكون مكتمل الفهرسة وتابعًا لهذه العائلة ولشركتها';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists document_families_effective_guard on public.document_families;
create trigger document_families_effective_guard
  before insert or update of effective_document_id on public.document_families
  for each row execute function public.assert_effective_is_indexed();

-- =====================================================================
-- أول إصدار في عائلة جديدة يصير فعّالًا تلقائيًا عند اكتمال فهرسته
--
-- وهذا استثناء مقصود ومحدود: **العائلة الفارغة وحدها.** فلو طُلب
-- اعتمادٌ صريح لأول ملفٍ ترفعه شركة، لانكسرت رحلة التجهيز القائمة
-- (ارفع مستندًا ← اسأل سؤالًا) ولم تجد الشركة جوابًا في أول دقيقة.
--
-- أما **إصدار جديد في عائلة لها إصدار فعّال فلا يصير مرجعًا إلا
-- باعتماد صريح** — وهو نصّ معيار القبول.
--
-- ومحلّه مُشغِّل في القاعدة لا كود تطبيق: الفهرسة تكتمل من أكثر من
-- مسار (رفع عادي، إعادة معالجة، استئناف قراءة ضوئية)، وشرطٌ في
-- أحدها لا يغطّي البقية.
-- =====================================================================

create or replace function public.activate_first_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'READY'
     and (old.status is distinct from 'READY')
     and new.family_id is not null then

    update public.document_families f
       set effective_document_id = new.id
     where f.id = new.family_id
       and f.company_id = new.company_id
       and f.effective_document_id is null;

    if found then
      insert into public.document_version_events
        (company_id, family_id, document_id, event, actor_id, note)
      values (new.company_id, new.family_id, new.id, 'FIRST_EFFECTIVE',
              new.uploaded_by, 'أول إصدار في العائلة — صار فعّالًا عند اكتمال الفهرسة');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists documents_activate_first_version on public.documents;
create trigger documents_activate_first_version
  after update of status on public.documents
  for each row execute function public.activate_first_version();

-- =====================================================================
-- اعتماد إصدار — الخطوة الوحيدة التي تبدّل مرجع الشركة
--
-- `security invoker` عن قصد: تمرّ بـRLS فلا تتجاوز حدّ الشركة، ومع
-- ذلك تتحقق من الشركة والدور صراحةً — حاجزان لا حاجز.
-- =====================================================================

create or replace function public.approve_document_version(
  p_document_id   uuid,
  p_effective_from date default null,
  p_note          text default null
)
returns uuid
language plpgsql
volatile
-- `security definer` لأن هذه الدالّة تكتب في سجلّ الإصدارات، وهو
-- سجلٌّ **بلا سياسة كتابة لأي دور** عن قصد: لا يُضاف إليه حدثٌ إلا من
-- داخل دالّة. والهوية محفوظة رغم ذلك — `current_company_id()` تقرأ
-- `auth.uid()` من رمز المنادي، والشركة والدور مفحوصان صراحةً أدناه.
security definer
set search_path = public
as $$
declare
  v_company   uuid := public.current_company_id();
  v_family    uuid;
  v_status    public.document_status;
  v_previous  uuid;
  v_interval  int;
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
  -- أي سياسةً «معتمدة» لا يجدها أحد.
  if v_status <> 'READY' then
    raise exception 'document_not_indexed';
  end if;

  select f.effective_document_id, f.review_interval_months
    into v_previous, v_interval
    from public.document_families f
   where f.id = v_family and f.company_id = v_company;

  -- (١) الإصدار السابق يُستبدل
  if v_previous is not null and v_previous <> p_document_id then
    update public.documents
       set approval_status = 'SUPERSEDED'
     where id = v_previous and company_id = v_company;

    insert into public.document_version_events
      (company_id, family_id, document_id, event, actor_id, note)
    values (v_company, v_family, v_previous, 'SUPERSEDED', auth.uid(),
            'استبدله إصدار أحدث');
  end if;

  -- (٢) الإصدار الجديد يُعتمد
  update public.documents
     set approval_status        = 'APPROVED',
         approved_by            = auth.uid(),
         approved_at            = now(),
         effective_from         = coalesce(p_effective_from, current_date),
         supersedes_document_id = case when v_previous <> p_document_id
                                       then v_previous else supersedes_document_id end
   where id = p_document_id and company_id = v_company;

  -- (٣) ومؤشّر العائلة يتحرك **في المعاملة نفسها** — فلا فترة خليط
  update public.document_families
     set effective_document_id = p_document_id,
         last_reviewed_at      = now(),
         review_due_at         = case
             when v_interval is not null
             then (current_date + (v_interval || ' months')::interval)::date
             else review_due_at
           end
   where id = v_family and company_id = v_company;

  insert into public.document_version_events
    (company_id, family_id, document_id, event, actor_id, note)
  values (v_company, v_family, p_document_id, 'APPROVED', auth.uid(), p_note);

  return v_family;
end;
$$;

revoke all on function public.approve_document_version(uuid, date, text) from public;
grant execute on function public.approve_document_version(uuid, date, text) to authenticated;

-- =====================================================================
-- أرشفة إصدار — ولا تُترك العائلة بلا مرجع صامتًا
-- =====================================================================

create or replace function public.archive_document_version(
  p_document_id uuid,
  p_note        text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_company uuid := public.current_company_id();
  v_family  uuid;
begin
  if v_company is null or not public.is_company_admin() then
    raise exception 'not_authorized';
  end if;

  select family_id into v_family
    from public.documents
   where id = p_document_id and company_id = v_company;

  if v_family is null then raise exception 'document_not_found'; end if;

  update public.documents
     set approval_status = 'ARCHIVED',
         status          = 'ARCHIVED',
         archived_by     = auth.uid(),
         archived_at     = now()
   where id = p_document_id and company_id = v_company;

  -- لو كان هو الفعّال، تُفرَّغ إشارة العائلة صراحةً: شركةٌ بلا مرجع
  -- أوضح من شركةٍ مرجعُها مؤرشف.
  update public.document_families
     set effective_document_id = null
   where id = v_family and company_id = v_company
     and effective_document_id = p_document_id;

  insert into public.document_version_events
    (company_id, family_id, document_id, event, actor_id, note)
  values (v_company, v_family, p_document_id, 'ARCHIVED', auth.uid(), p_note);
end;
$$;

revoke all on function public.archive_document_version(uuid, text) from public;
grant execute on function public.archive_document_version(uuid, text) to authenticated;

-- =====================================================================
-- RLS
-- =====================================================================

alter table public.document_families       enable row level security;
alter table public.document_families       force  row level security;
alter table public.document_version_events enable row level security;
alter table public.document_version_events force  row level security;

-- العائلة يراها من يرى المستندات في شركته.
drop policy if exists document_families_select on public.document_families;
create policy document_families_select on public.document_families
  for select to authenticated
  using (public.belongs_to_current_company(company_id));

drop policy if exists document_families_write on public.document_families;
create policy document_families_write on public.document_families
  for all to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_company_admin())
  with check (public.belongs_to_current_company(company_id) and public.is_company_admin());

-- السجلّ يُقرأ ولا يُكتب من الواجهة: الكتابة داخل الدوالّ وحدها.
drop policy if exists document_version_events_select on public.document_version_events;
create policy document_version_events_select on public.document_version_events
  for select to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_manager_or_above());

grant select, insert, update, delete on public.document_families to authenticated;
grant select on public.document_version_events to authenticated;

-- =====================================================================
-- ترحيل الوثائق القائمة
--
-- القاعدة المطلوبة صريحة: **بلا تعطيل استخدامها، وبلا افتراض أنها
-- معتمدة بقرار موثَّق.** والاثنان متعارضان ظاهريًا، وهذا حلّهما:
--
--   • لكل وثيقة قائمة عائلةٌ خاصة بها، وتُجعل الإصدار الفعّال فيها
--     ⇒ الإجابات تعمل كما كانت، بلا انقطاع ولا فرق يلمسه مستخدم.
--   • وحالتها `MIGRATED_UNREVIEWED` لا `APPROVED`
--     ⇒ لا ندّعي اعتمادًا لم يحدث، وتظهر في الواجهة بوسم صريح.
--   • وحدث `MIGRATED` مسجَّل لكل واحدة.
--
-- والوثائق المؤرشفة تُرحَّل بلا أن تصير فعّالة.
-- =====================================================================

do $$
declare
  r record;
  v_family uuid;
begin
  for r in
    select id, company_id, name, category_id, status, uploaded_by, created_at
      from public.documents
     where family_id is null
     order by created_at
  loop
    insert into public.document_families
      (company_id, title, category_id, created_by, created_at)
    values (r.company_id, r.name, r.category_id, r.uploaded_by, r.created_at)
    returning id into v_family;

    update public.documents
       set family_id       = v_family,
           version_label   = '1',
           approval_status = case
             when r.status = 'ARCHIVED' then 'ARCHIVED'::public.doc_approval_status
             else 'MIGRATED_UNREVIEWED'::public.doc_approval_status
           end
     where id = r.id;

    -- الفعّالية للمفهرسة وحدها — والمُشغِّل لا يعمل على صفٍّ كان READY
    -- قبل الترحيل، فتُضبَط هنا صراحةً.
    if r.status = 'READY' then
      update public.document_families
         set effective_document_id = r.id
       where id = v_family;
    end if;

    insert into public.document_version_events
      (company_id, family_id, document_id, event, actor_id, note)
    values (r.company_id, v_family, r.id, 'MIGRATED', null,
            'رُحّلت مع إطلاق نظام الإصدارات — تعمل كمرجع ولم يُسجَّل قرار اعتماد لها');
  end loop;
end
$$;

-- =====================================================================
-- كل إصدار يلزمه عائلة — وتُستحدث له تلقائيًا إن لم تُحدَّد
--
-- ولولا هذا لوجب تعديل كل مسار يُدخل مستندًا: الرفع، والإجابة
-- المعتمَدة، ونشر السياسة، والبيانات التجريبية، ومثبّتات الاختبار.
-- وتعديلٌ في خمسة مواضع يُنسى في سادس، فيسقط الإدخال في الإنتاج.
--
-- فالقاعدة تتولّاها: من يرفع **إصدارًا جديدًا لوثيقة قائمة** يمرّر
-- `family_id` صريحًا، ومن يرفع **وثيقة جديدة** لا يمرّر شيئًا فتُنشأ
-- له هويةٌ باسم الملف.
-- =====================================================================

create or replace function public.ensure_document_family()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid;
begin
  if new.family_id is null then
    insert into public.document_families
      (company_id, title, category_id, created_by)
    values (new.company_id, new.name, new.category_id, new.uploaded_by)
    returning id into v_family;

    new.family_id := v_family;
    if new.version_label is null then
      new.version_label := '1';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists documents_ensure_family on public.documents;
create trigger documents_ensure_family
  before insert on public.documents
  for each row execute function public.ensure_document_family();

/*
 * ومستندٌ يُدخَل وهو READY أصلًا (البيانات التجريبية، ومثبّتات
 * الاختبار، والإجابة المعتمَدة التي تُفهرس قبل إدخال صفّها) لا يمرّ
 * بمُشغِّل التحديث، فيبقى بلا إصدار فعّال وتعود الإجابات خاوية.
 * وهذا ما يسدّه هذا المُشغِّل.
 */
create or replace function public.activate_first_version_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'READY' and new.family_id is not null then
    update public.document_families f
       set effective_document_id = new.id
     where f.id = new.family_id
       and f.company_id = new.company_id
       and f.effective_document_id is null;
  end if;
  return new;
end;
$$;

drop trigger if exists documents_activate_on_insert on public.documents;
create trigger documents_activate_on_insert
  after insert on public.documents
  for each row execute function public.activate_first_version_on_insert();

alter table public.documents
  alter column family_id set not null;

-- =====================================================================
-- الاسترجاع: الإجابات الاعتيادية من الإصدار الفعّال وحده
--
-- شروط الرؤية (الشركة والدور والقسم) **تُترك كما هي حرفًا بحرف**،
-- ويُضاف شرطٌ واحد فوقها. ولا يُعاد ترتيبها ولا تُبسَّط: هي بوابة
-- العزل، وأي تحرير فيها يحتاج اختبار الطفرات كاملًا.
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
  -- بركةٌ أوسع من المطلوب: الدمج يحتاج مرشّحين ليرتّبهم
  v_pool    int := greatest(p_match_count * 3, 30);
begin
  select company_id, role, department_id
    into v_company, v_role, v_dept
  from public.profiles
  where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    return;
  end if;

  -- بناء الاستعلام اللفظيّ منسوخ حرفًا بحرف من `0032`. ولا يُعاد
  -- كتابته: أيّ فرقٍ هنا يجعل المسار اللفظيّ يرتّب غير ما يرتّبه
  -- الأصل، فتتغيّر الإجابات بلا سبب ظاهر.
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
    -- الإصدار الفعّال لعائلته وحده يُجيب. وهذا هو موضع القاعدة:
    -- «حداثة الرفع لا تعني المرجعية» — المسودة والمستبدَل والمؤرشف
    -- كلها خارج الإجابات الاعتيادية بلا استثناء.
    join public.document_families f
      on f.id = d.family_id
     and f.company_id = d.company_id
     and f.effective_document_id = d.id
    -- شروط الرؤية منسوخة حرفًا بحرف من `match_document_chunks`.
    -- ولا يُجتهد فيها: مسارٌ ثانٍ بقواعد رؤية مختلفة — ولو باختلافٍ
    -- يسير — يفتح على المستأجرين بابًا يغلقه الأول، وهو أخطر ما يمكن
    -- أن يقع في هذا المنتج.
    where c.company_id = v_company
      and d.company_id = v_company
      and d.status = 'READY'
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
-- الاسترجاع التاريخي المصرَّح به: إصدار بعينه
--
-- للأسئلة التاريخية والمقارنة. **لا تُستعمل في الإجابات الاعتيادية**،
-- وتُطبّق شروط الرؤية نفسها، فلا تصير بابًا خلفيًا إلى مستند محجوب.
-- =====================================================================

create or replace function public.chunks_of_document_version(
  p_document_id uuid
)
returns table (
  chunk_id      uuid,
  chunk_index   int,
  content       text,
  page_number   int,
  section_title text
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
begin
  select p.company_id, p.role, p.department_id
    into v_company, v_role, v_dept
    from public.profiles p
   where p.id = auth.uid() and p.status = 'ACTIVE';

  if v_company is null then return; end if;

  return query
  select c.id, c.chunk_index, c.content, c.page_number, c.section_title
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
   where c.document_id = p_document_id
     and c.company_id = v_company
     and d.company_id = v_company
     and (
       v_role = 'COMPANY_ADMIN'
       or d.visibility = 'COMPANY'
       or (d.visibility = 'DEPARTMENT'
           and v_dept is not null
           and v_dept = any (d.allowed_department_ids))
       or (d.visibility = 'ROLE' and v_role = any (d.allowed_roles))
     )
   order by c.chunk_index;
end;
$$;

revoke all on function public.chunks_of_document_version(uuid) from public;
grant execute on function public.chunks_of_document_version(uuid) to authenticated;
