-- =====================================================================
-- 0040 — استوديو السياسات: المسوّدة ونسخها واعتمادها
-- =====================================================================
-- الطبقة الثانية فوق المكتبة المرجعية (0039). المسوّدة تُكتب هنا، وتبقى
-- هنا، ولا تصل موظفًا حتى يعتمدها مدير — فتُنسخ عندئذٍ مستندًا في
-- قاعدة المعرفة بالأنبوب القائم نفسه.
--
-- ---------------------------------------------------------------------
-- لماذا جدول مستقلّ لا `documents` بحالة «مسوّدة»
-- ---------------------------------------------------------------------
-- المسوّدة ليست مستندًا ناقصًا، بل شيء آخر: نصٌّ تنظيميّ **لم يُقرّه
-- أحد**. ولو سكنت `documents` بحالةٍ إضافية، لصار بينها وبين الفهرسة
-- شرطٌ واحد في كل استعلام — وسهوُ شرطٍ واحد يعني أن سياسةً لم يوقّعها
-- أحد تجيب موظفًا باسم شركته.
--
-- فالفصل هنا ليس ترتيبًا، بل هو الحاجز: **لا يوجد مسار** من هذا الجدول
-- إلى الفهرسة إلا عبور المدير. والنشر ينسخ النصّ إلى `documents` ولا
-- يرقّي المسوّدة.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ١) نوع المستند: سياسة مكتوبة داخل المنصّة
-- ---------------------------------------------------------------------
-- تُضاف القيمة هنا ولا تُستعمل في هذه الهجرة — قيمةُ enum مضافة في
-- معاملة لا تصلح للاستعمال داخلها.

alter type public.document_source add value if not exists 'AUTHORED_POLICY';

-- ---------------------------------------------------------------------
-- ٢) حالات المسوّدة
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'policy_draft_status') then
    create type public.policy_draft_status as enum
      ('DRAFT', 'APPROVED', 'DISCARDED');
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- ٣) المسوّدة
-- ---------------------------------------------------------------------

create table if not exists public.policy_drafts (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  -- أصلها: فجوة معرفية أو طلب مباشر. تُترك فارغة في الثاني.
  gap_id         uuid references public.knowledge_gaps(id) on delete set null,
  title          text not null,
  topic          text not null,
  -- أسئلة المعالج وأجوبة المدير: تُحفظ لأن المسوّدة تُعاد توليدًا عند
  -- تغيير جواب، ولأن «على أي أساس كُتبت هذه السياسة» سؤال تدقيق.
  clarifications jsonb not null default '[]'::jsonb,
  body           text not null default '',
  -- الاستشهادات النظامية التي بُنيت عليها — تُعرض تحت المسوّدة، ومن
  -- دونها تُحذف الجملة التنظيمية قبل العرض.
  citations      jsonb not null default '[]'::jsonb,
  status         public.policy_draft_status not null default 'DRAFT',
  version        int not null default 1,
  -- المستند المنشور في قاعدة المعرفة، إن اعتُمدت
  document_id    uuid references public.documents(id) on delete set null,
  created_by     uuid references public.profiles(id) on delete set null,
  approved_by    uuid references public.profiles(id) on delete set null,
  approved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint policy_drafts_title_not_blank check (length(btrim(title)) > 0),
  constraint policy_drafts_topic_not_blank check (length(btrim(topic)) > 0),
  -- حاجز بنيوي: لا تُعتمد مسوّدة بلا معتمِد ولا تاريخ. الاعتماد حدثٌ
  -- له صاحب، لا علَمٌ يُرفع.
  constraint policy_drafts_approval_complete check (
    status <> 'APPROVED'
    or (approved_by is not null and approved_at is not null)
  )
);

create index if not exists policy_drafts_company_idx
  on public.policy_drafts (company_id, status, updated_at desc);

create index if not exists policy_drafts_gap_idx
  on public.policy_drafts (gap_id) where gap_id is not null;

-- ---------------------------------------------------------------------
-- ٤) النسخ المؤرّخة
-- ---------------------------------------------------------------------
-- «من غيّر سياسة الإجازات ومتى» سؤال تدقيق حتمي، وجوابه لا يُستخرج من
-- عمودٍ يُكتب فوقه. فكل حفظ نسخة، ولا تُحذف نسخة أبدًا.

create table if not exists public.policy_draft_versions (
  id         uuid primary key default gen_random_uuid(),
  draft_id   uuid not null references public.policy_drafts(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  version    int not null,
  body       text not null,
  note       text,
  author_id  uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint policy_draft_versions_unique unique (draft_id, version)
);

create index if not exists policy_draft_versions_draft_idx
  on public.policy_draft_versions (draft_id, version desc);

-- ---------------------------------------------------------------------
-- ٥) الصلاحيات: إدارة الشركة وحدها — ولا موظف يرى مسوّدة
-- ---------------------------------------------------------------------
-- المسوّدة نصّ لم يُقرّ. ورؤيتها لموظف تعني أنه قد يعمل بها، وهذا
-- بالضبط ما يمنعه الاستوديو.

alter table public.policy_drafts         enable row level security;
alter table public.policy_draft_versions enable row level security;

drop policy if exists policy_drafts_all on public.policy_drafts;
create policy policy_drafts_all on public.policy_drafts
  for all to authenticated
  using (
    public.belongs_to_current_company(company_id)
    and public.is_company_admin()
  )
  with check (
    public.belongs_to_current_company(company_id)
    and public.is_company_admin()
  );

drop policy if exists policy_draft_versions_all on public.policy_draft_versions;
create policy policy_draft_versions_all on public.policy_draft_versions
  for all to authenticated
  using (
    public.belongs_to_current_company(company_id)
    and public.is_company_admin()
  )
  with check (
    public.belongs_to_current_company(company_id)
    and public.is_company_admin()
  );

grant select, insert, update, delete on public.policy_drafts         to authenticated;
grant select, insert, update, delete on public.policy_draft_versions to authenticated;

-- ---------------------------------------------------------------------
-- ٦) حفظ نسخة — دالّة واحدة تكتب المسوّدة وتؤرّخها معًا
-- ---------------------------------------------------------------------
-- لو تُركا نداءين من التطبيق، لَمرّ يومٌ يُكتب فيه النصّ ولا تُحفظ
-- نسخته — فيسقط سجلّ التغيير بلا أن يلاحظ أحد. فهما هنا معاملة واحدة.

create or replace function public.save_policy_draft_version(
  p_draft_id uuid,
  p_body     text,
  p_note     text default null
)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company uuid;
  v_version int;
begin
  if p_body is null or length(btrim(p_body)) < 40 then
    raise exception 'draft_too_short';
  end if;

  -- RLS تحرس الصفّ؛ وغيابه هنا يعني أنه ليس لشركة المنادي أو أنه ليس
  -- مديرًا. ولا نكشف أيّهما.
  select company_id into v_company
  from public.policy_drafts
  where id = p_draft_id and status = 'DRAFT';

  if v_company is null then
    raise exception 'draft_not_editable';
  end if;

  update public.policy_drafts
  set body       = btrim(p_body),
      version    = version + 1,
      updated_at = now()
  where id = p_draft_id
  returning version into v_version;

  insert into public.policy_draft_versions
    (draft_id, company_id, version, body, note, author_id)
  values
    (p_draft_id, v_company, v_version, btrim(p_body), p_note, auth.uid());

  return v_version;
end;
$$;

revoke all on function public.save_policy_draft_version(uuid, text, text) from public;
grant execute on function public.save_policy_draft_version(uuid, text, text)
  to authenticated;

comment on table public.policy_drafts is
  'مسوّدات السياسات قبل الاعتماد. لا مسار منها إلى الفهرسة إلا باعتماد '
  'مدير الشركة، والنشر ينسخ النصّ إلى documents ولا يرقّي المسوّدة.';
