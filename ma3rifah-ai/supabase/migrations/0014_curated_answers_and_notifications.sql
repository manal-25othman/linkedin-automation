-- =====================================================================
-- 0014 — الإجابات المعتمدة والتنبيهات
--
-- تكشف فجوات المعرفة ما لا تجيب عنه المستندات، ثم تقف عند الكشف: يكتب
-- المدير «ملاحظة معالجة» فتُخزَّن ولا تدخل قاعدة المعرفة، فيسمع الموظف
-- «لم أجد معلومات» عن سؤال أُجيب عنه بالفعل. حقل يعطي إحساس الإنجاز
-- بلا أثر أسوأ من غيابه، لأنه يُسكت السؤال دون أن يحلّه.
--
-- الحل هنا: الإجابة المعتمدة **مستند حقيقي** لا نوع جديد من البيانات.
-- بذلك تسري عليها كل الضوابط المثبتة أصلًا — عزل الشركات، صلاحيات
-- الأقسام والأدوار، البحث الدلالي — بلا تعديل حرف في دالة البحث ولا
-- سياسة جديدة يمكن أن تُنسى. أضمن طريق لعدم كسر العزل هو ألّا نضيف
-- مسارًا جديدًا إليه.
-- =====================================================================

-- ---------- مصدر المستند ----------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'document_source') then
    create type public.document_source as enum ('UPLOAD', 'CURATED_ANSWER');
  end if;
end
$$;

alter table public.documents
  add column if not exists source_kind public.document_source not null default 'UPLOAD';

comment on column public.documents.source_kind is
  'UPLOAD = ملف رفعه المستخدم، CURATED_ANSWER = إجابة كتبها مدير الشركة لسدّ فجوة';

-- ---------- ربط الفجوة بإجابتها ----------

alter table public.knowledge_gaps
  add column if not exists answer_text text,
  add column if not exists answer_document_id uuid
    references public.documents(id) on delete set null;

comment on column public.knowledge_gaps.answer_text is
  'نص الإجابة المعتمدة كما كتبها المدير — المصدر، والمستند مشتقّ منه';

-- =====================================================================
-- من سأل الفجوة — لإغلاق الدائرة معه حين تُحلّ
-- =====================================================================

create table if not exists public.knowledge_gap_askers (
  gap_id     uuid not null references public.knowledge_gaps(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  asked_at   timestamptz not null default now(),
  notified_at timestamptz,
  primary key (gap_id, user_id)
);

create index if not exists knowledge_gap_askers_company_idx
  on public.knowledge_gap_askers (company_id, gap_id);

alter table public.knowledge_gap_askers enable row level security;

-- يراها من يرى الفجوات (مدير قسم فأعلى)، وصاحبها يرى صفّه وحده.
drop policy if exists gap_askers_select on public.knowledge_gap_askers;
create policy gap_askers_select on public.knowledge_gap_askers
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and (public.is_manager_or_above() or user_id = auth.uid())
  );

-- لا سياسة كتابة إطلاقًا: التسجيل يتم داخل دالة security definer وحدها.

-- =====================================================================
-- التنبيهات
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type public.notification_type as enum (
      'GAP_ANSWERED',      -- سؤالك الذي لم يجد إجابة صار له جواب
      'GAP_OPENED',        -- سؤال جديد بلا إجابة يحتاج نظر الإدارة
      'DOCUMENT_FAILED',   -- فشلت معالجة مستند
      'DOCUMENT_READY',    -- اكتملت معالجة مستند
      'QUOTA_WARNING',     -- اقتراب الحصة الشهرية من النفاد
      'LOW_CONFIDENCE'     -- إجابات منخفضة الثقة تحتاج مراجعة
    );
  end if;
end
$$;

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  -- المستلم. التنبيه شخصي دائمًا: لا تنبيه «للشركة» يقرؤه الجميع
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        public.notification_type not null,
  title       text not null,
  body        text,
  -- مسار داخل التطبيق ينقل المستخدم إلى موضع الحدث
  link        text,
  entity_type text,
  entity_id   uuid,
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  constraint notifications_title_not_blank check (length(btrim(title)) > 0),
  -- مسار داخلي فقط: قيمة تبدأ بـ// أو بمخطّط تصير إعادة توجيه خارجية
  constraint notifications_link_internal check (
    link is null or (link ~ '^/[^/]' or link = '/')
  )
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

-- منع إغراق المستخدم بتنبيه مكرر عن الحدث نفسه.
--
-- بلا شرط WHERE عمدًا: الفهرس الجزئي لا يصلح مُحكِّمًا لـ ON CONFLICT،
-- فتفشل كل عمليات الإدراج بالخطأ 42P10 ولا يُنشأ تنبيه قط (انظر 0019).
-- والدلالة واحدة على أي حال، لأن NULL مغاير لِـ NULL افتراضًا، فتبقى
-- التنبيهات بلا كيان مسموحة بلا حدّ.
create unique index if not exists notifications_unique_event_idx
  on public.notifications (user_id, type, entity_id);

alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = auth.uid() and company_id = public.current_company_id());

-- لا سياسة إدراج ولا تحديث ولا حذف: الإنشاء بمفتاح الخدمة، والتعليم
-- كمقروء عبر دالة محصورة أدناه. لو فُتح التحديث لصار بوسع المستخدم
-- تعديل نص تنبيهه — وهو ما لا حاجة إليه أصلًا.

-- ---------- تعليم التنبيهات كمقروءة ----------

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  update public.notifications
     set read_at = now()
   where user_id = auth.uid()
     and read_at is null
     and (p_ids is null or id = any (p_ids));

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- =====================================================================
-- تسجيل السائل عند إنشاء الفجوة
-- =====================================================================

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

  -- يُحفظ السائل كي يصله التنبيه حين تُحلّ فجوته. بلا هذا تبقى الدائرة
  -- مفتوحة: يُجاب السؤال ولا يعلم صاحبه، فلا يعود ليسأل.
  if v_gap_id is not null then
    insert into public.knowledge_gap_askers (gap_id, user_id, company_id)
    values (v_gap_id, auth.uid(), v_company)
    on conflict (gap_id, user_id) do update set asked_at = now();
  end if;

  return v_gap_id;
end;
$$;

revoke all on function public.record_knowledge_gap(text) from public, anon;
grant execute on function public.record_knowledge_gap(text) to authenticated;

-- =====================================================================
-- عدّاد التنبيهات غير المقروءة
-- =====================================================================

create or replace function public.unread_notification_count()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.notifications
  where user_id = auth.uid() and read_at is null;
$$;

revoke all on function public.unread_notification_count() from public, anon;
grant execute on function public.unread_notification_count() to authenticated;

grant select on public.notifications to authenticated;
grant select on public.knowledge_gap_askers to authenticated;
